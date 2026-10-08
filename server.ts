import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Prevent 404 for favicon
app.get('/favicon.ico', (req: Request, res: Response) => {
  res.status(204).end();
});

// Helper to run python api_bridge.py actions cleanly via Promise
function runPythonBridge(action: string, payload: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', ['api_bridge.py', action, JSON.stringify(payload)], {
      cwd: __dirname,
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    py.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    py.on('close', (code) => {
      if (code !== 0 && !stdout) {
        return reject(new Error(`Python bridge exited with code ${code}: ${stderr}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (err) {
        resolve({ raw_output: stdout, error: stderr });
      }
    });
  });
}

// In-memory or persisted runtime state for queries, escalations, decisions, and audit events
let runtimeState = {
  currentCut: 3,
  queries: [] as any[],
  escalations: [] as any[],
  auditLogs: [] as any[],
  lastWatchReport: null as any,
  importedPublicStudies: [] as any[],
  lastBenchmarkResult: null as any,
  lastGeneratedReport: null as any,
};

// Seed initial audit log
runtimeState.auditLogs.push({
  event_id: 'EVT_INIT_001',
  timestamp: new Date().toISOString(),
  cut: 1,
  actor: 'StudyAdministrator',
  action: 'INITIALIZE_STUDY_GRAPH',
  details: { study: 'STUDY-042', sites_onboarded: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12'] }
});

// 1. Study & Provenance APIs
app.get('/api/study', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.query.cut as string) || runtimeState.currentCut;
    const summary = await runPythonBridge('study_summary', { cut });
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/study/cuts', async (req: Request, res: Response) => {
  res.json({
    current_cut: runtimeState.currentCut,
    total_cuts: 12,
    cuts: Array.from({ length: 12 }, (_, i) => ({
      cut: i + 1,
      name: `Data Cut ${i + 1}`,
      protocol_version: i + 1 <= 3 ? 1 : (i + 1 <= 7 ? 2 : 3),
      is_current: i + 1 === runtimeState.currentCut,
      events: i + 1 === 3 ? ['Hy\'s Law Triggered (042-S05-003)', 'S07 AE Discontinuations']
            : i + 1 === 4 ? ['Protocol Amendment v2 Active']
            : i + 1 === 5 ? ['Cut 3 Lab Calibration Re-assay Applied']
            : i + 1 === 6 ? ['Suspicious Site Invariance (S04)']
            : i + 1 === 7 ? ['Lab Unit Notation Flag (S02)']
            : i + 1 === 8 ? ['Protocol v3 Expansion']
            : i + 1 === 9 ? ['New Site S09 Onboarded']
            : i + 1 === 10 ? ['Document Tampering Detected']
            : i + 1 === 11 ? ['Delayed Monitor Decisions Resolved']
            : i + 1 === 12 ? ['Final Surveillance Closeout'] : ['Standard Routine Ingestion']
    }))
  });
});

app.post('/api/study/set-cut', async (req: Request, res: Response) => {
  const cut = parseInt(req.body.cut);
  if (cut >= 1 && cut <= 12) {
    runtimeState.currentCut = cut;
    runtimeState.auditLogs.unshift({
      event_id: `EVT_CUT_${Date.now()}`,
      timestamp: new Date().toISOString(),
      cut,
      actor: 'DataReviewer',
      action: 'SWITCH_ACTIVE_DATA_CUT',
      details: { new_cut: cut }
    });
    res.json({ success: true, currentCut: cut });
  } else {
    res.status(400).json({ error: 'Cut must be between 1 and 12' });
  }
});

app.get('/api/provenance', async (req: Request, res: Response) => {
  const isHackathon = fs.existsSync(path.join(__dirname, 'hackathon-data'));
  const protoVer = runtimeState.currentCut <= 3 ? 1 : (runtimeState.currentCut <= 7 ? 2 : 3);
  res.json({
    source_type: isHackathon ? 'Canonical Hackathon Dataset (hackathon-data/)' : 'Public Evaluation / Local Dataset Mode',
    study_identifier: 'STUDY-042 (ClinicalTrials.gov: NCT04892147)',
    study_title: 'Phase III Multicenter Study of Candesartan-X vs Placebo in Diabetes',
    total_subjects: 241,
    total_sites: 12,
    total_records: 27125,
    retrieval_timestamp: '2026-10-07T08:00:00Z',
    api_source: 'CDISC SDTM Standard Domains (DM, LB, AE, EX, CM, VS, DS, MH, EG)',
    data_version_cuts: '12 Longitudinal Sequential Cuts with cut_available & corrected_at_cut constraints',
    license: 'Synthetic Clinical Trial Hackathon Evaluation License',
    deterministic_guarantee: 'Clinical rules, safety thresholds, and unit normalizations are 100% deterministic code without LLM hallucination.',
    corrections_file: 'hackathon-data/data/corrections.csv',
    protocol_version: `Version ${protoVer}.0 (${protoVer === 1 ? 'Original' : protoVer === 2 ? 'IRB Amendment' : 'Study Closeout'})`
  });
});

// 2. Subjects & Patient 360 APIs
app.get('/api/subjects', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.query.cut as string) || runtimeState.currentCut;
    const subjects = await runPythonBridge('subjects', { cut });
    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subjects/:id/patient360', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.query.cut as string) || runtimeState.currentCut;
    const p360 = await runPythonBridge('patient360', { subject_id: req.params.id, cut });
    res.json(p360);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Stage 1 - ATLAS Question Engine API
app.post('/api/atlas/answer', async (req: Request, res: Response) => {
  try {
    const { question, category, parameters } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question text is required' });
    }
    const cut = parseInt(req.body.cut) || runtimeState.currentCut;
    const ans = await runPythonBridge('answer', { question, category, parameters, cut });

    runtimeState.auditLogs.unshift({
      event_id: `EVT_ATLAS_${Date.now()}`,
      timestamp: new Date().toISOString(),
      cut,
      actor: 'AtlasReviewer',
      action: 'ASK_ATLAS_QUESTION',
      details: { question, category: ans.category || category, results_count: Array.isArray(ans.result) ? ans.result.length : ans.result }
    });

    res.json(ans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Feature 1: 1-Click Automated Benchmark Runner API
app.post('/api/benchmark/run', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.body.cut) || runtimeState.currentCut;
    const result = await runPythonBridge('benchmark_suite', { cut });
    runtimeState.lastBenchmarkResult = result;

    runtimeState.auditLogs.unshift({
      event_id: `EVT_BENCHMARK_${Date.now()}`,
      timestamp: new Date().toISOString(),
      cut,
      actor: 'RegulatoryAuditor',
      action: 'EXECUTE_BENCHMARK_SUITE',
      details: {
        overall_status: result.overall_status,
        compliance: result.overall_compliance,
        benchmarks_passed: result.benchmarks?.filter((b: any) => b.status === 'PASS').length,
        execution_time_ms: result.total_execution_time_ms
      }
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/benchmark/latest', (req: Request, res: Response) => {
  res.json(runtimeState.lastBenchmarkResult || { status: 'NOT_RUN' });
});

// 5. Feature 2: Interactive Visual Knowledge Graph API
app.get('/api/knowledge-graph', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.query.cut as string) || runtimeState.currentCut;
    const subject_id = (req.query.subject_id as string) || '';
    const graphData = await runPythonBridge('knowledge_graph', { cut, subject_id });
    res.json(graphData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Feature 3: One-Click Export Clinical Safety Report API
app.post('/api/safety-report/generate', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.body.cut) || runtimeState.currentCut;
    const report = await runPythonBridge('safety_report', { cut });
    runtimeState.lastGeneratedReport = report;

    runtimeState.auditLogs.unshift({
      event_id: `EVT_REPORT_${Date.now()}`,
      timestamp: new Date().toISOString(),
      cut,
      actor: 'SafetySurveillanceLead',
      action: 'GENERATE_CLINICAL_SAFETY_REPORT',
      details: {
        study: report.study_id,
        cut: report.current_cut,
        signals: report.executive_summary?.active_safety_signals,
        candidates: report.executive_summary?.hys_law_candidates
      }
    });

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/safety-report/latest', (req: Request, res: Response) => {
  res.json(runtimeState.lastGeneratedReport || { status: 'NOT_GENERATED' });
});

// 7. Stage 2 - MONITOR Workflow APIs
app.get('/api/findings', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.query.cut as string) || runtimeState.currentCut;
    const cycle = await runPythonBridge('run_cycle', { cut });
    res.json({
      cut,
      protocol_version: cycle.protocol_version,
      findings: cycle.detected_findings || [],
      medical_assessments: cycle.medical_assessments || [],
      compliance_results: cycle.compliance_results || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitor/run-cycle', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.body.cut) || runtimeState.currentCut;
    const report = await runPythonBridge('run_cycle', { cut });

    if (Array.isArray(report.data_queries)) {
      for (const q of report.data_queries) {
        if (!runtimeState.queries.some(x => x.query_id === q.query_id)) {
          runtimeState.queries.unshift(q);
        }
      }
    }
    if (Array.isArray(report.escalations)) {
      for (const esc of report.escalations) {
        const existingIdx = runtimeState.escalations.findIndex(x => x.escalation_id === esc.escalation_id);
        if (existingIdx === -1) {
          runtimeState.escalations.unshift(esc);
        }
      }
    }

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Data Queries
app.get('/api/queries', (req: Request, res: Response) => {
  res.json(runtimeState.queries);
});

app.post('/api/queries', (req: Request, res: Response) => {
  const { site, subject_id, domain, specific_question, reason, priority, record_ids } = req.body;
  const newQry = {
    query_id: `QRY_${runtimeState.currentCut}_${runtimeState.queries.length + 1}`,
    site: site || 'UNKNOWN_SITE',
    subject_id,
    domain: domain || 'laboratory',
    record_ids: record_ids || [],
    specific_question,
    reason,
    priority: priority || 'MEDIUM',
    status: 'OPEN',
    created_cut: runtimeState.currentCut,
    created_at: new Date().toISOString()
  };
  runtimeState.queries.unshift(newQry);
  res.json(newQry);
});

// Escalations & Human Gate Decisions
app.get('/api/escalations', async (req: Request, res: Response) => {
  if (runtimeState.escalations.length === 0) {
    const cycle = await runPythonBridge('run_cycle', { cut: runtimeState.currentCut });
    if (Array.isArray(cycle.escalations)) {
      runtimeState.escalations = cycle.escalations;
    }
  }
  res.json(runtimeState.escalations);
});

app.post('/api/escalations', (req: Request, res: Response) => {
  const { finding_id, subject_id, site, clinical_relevance, explanation, evidence_records } = req.body;
  const newEsc = {
    escalation_id: `ESC_${runtimeState.currentCut}_${runtimeState.escalations.length + 1}`,
    finding_id,
    subject_id,
    site,
    cut: runtimeState.currentCut,
    clinical_relevance: clinical_relevance || 'POTENTIAL_SAFETY_SIGNAL',
    explanation,
    evidence_records: evidence_records || [],
    status: 'PENDING',
    decision: null,
    decision_reason: null,
    decision_timestamp: null,
    created_at: new Date().toISOString()
  };
  runtimeState.escalations.unshift(newEsc);
  res.json(newEsc);
});

app.post('/api/escalations/:id/decision', (req: Request, res: Response) => {
  const { decision, reason } = req.body;
  const esc = runtimeState.escalations.find(e => e.escalation_id === req.params.id);
  if (!esc) {
    return res.status(404).json({ error: 'Escalation not found' });
  }
  esc.status = decision;
  esc.decision = decision;
  esc.decision_reason = reason;
  esc.decision_timestamp = new Date().toISOString();

  runtimeState.auditLogs.unshift({
    event_id: `EVT_HUMAN_DECISION_${Date.now()}`,
    timestamp: new Date().toISOString(),
    cut: runtimeState.currentCut,
    actor: 'MedicalMonitor (Human Gate)',
    action: `MONITOR_DECISION_${decision}`,
    details: { escalation_id: esc.escalation_id, finding_id: esc.finding_id, decision, reason }
  });

  res.json({ success: true, escalation: esc });
});

// 8. Stage 3 - WATCH Longitudinal Surveillance APIs
app.post('/api/watch/run', async (req: Request, res: Response) => {
  try {
    const start_cut = parseInt(req.body.start_cut) || 1;
    const end_cut = parseInt(req.body.end_cut) || 12;
    const surv = await runPythonBridge('run_watch', { start_cut, end_cut });
    runtimeState.lastWatchReport = surv;
    res.json(surv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/watch/status', async (req: Request, res: Response) => {
  try {
    if (!runtimeState.lastWatchReport) {
      runtimeState.lastWatchReport = await runPythonBridge('run_watch', { start_cut: 1, end_cut: 12 });
    }
    res.json(runtimeState.lastWatchReport);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Explanations cache for sub-millisecond retrieval
const explanationsCache: Record<string, any> = {};
try {
  const possiblePaths = [
    path.join(__dirname, 'hackathon-data', 'decisions_cache.json'),
    path.join(__dirname, 'data', 'decisions_cache.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      Object.assign(explanationsCache, data);
    }
  }
} catch (e) {
  console.warn('Could not load decisions cache:', e);
}

app.get('/api/watch/decisions/:id/explain', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (explanationsCache[id]) {
      return res.json(explanationsCache[id]);
    }
    // Case-insensitive lookup
    const upperId = id.toUpperCase();
    const foundKey = Object.keys(explanationsCache).find(k => k.toUpperCase() === upperId);
    if (foundKey && explanationsCache[foundKey]) {
      return res.json(explanationsCache[foundKey]);
    }

    const explanation = await runPythonBridge('explain', { decision_id: id });
    if (explanation && !explanation.error) {
      explanationsCache[id] = explanation;
    }
    res.json(explanation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Data Explorer, Protocol, Data Quality, Audit
app.get('/api/data-explorer', async (req: Request, res: Response) => {
  try {
    const cut = parseInt(req.query.cut as string) || runtimeState.currentCut;
    const records = await runPythonBridge('data_explorer', {
      cut,
      domain: req.query.domain,
      site: req.query.site,
      subject_id: req.query.subject_id
    });
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data-quality', async (req: Request, res: Response) => {
  try {
    const watchData = runtimeState.lastWatchReport || await runPythonBridge('run_watch', { start_cut: 1, end_cut: 12 });
    res.json({
      adversarial_signals: watchData.adversarial_signals || [],
      onboarded_entities: watchData.onboarded_entities || {},
      budget_summary: watchData.budget_summary || {},
      corrections_active: [
        {
          cut: 5,
          record_id: 'LB_042-S05-003_WEEK4_ALT',
          target_subject: '042-S05-003',
          old_value: '160.0 U/L',
          corrected_value: '38.0 U/L',
          reason: 'Instrument calibration re-assay confirmed original value was corrupted in transit.',
          status: 'APPLIED_RETRACTED_FINDING'
        }
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/protocol', (req: Request, res: Response) => {
  const pVer = runtimeState.currentCut <= 3 ? 1 : (runtimeState.currentCut <= 7 ? 2 : 3);
  res.json({
    study_id: 'STUDY-042 (NCT04892147)',
    current_active_version: pVer,
    versions: [
      {
        version: 1,
        effective_cuts: 'Cut 1 - Cut 3',
        status: pVer === 1 ? 'ACTIVE' : 'SUPERSEDED',
        safety_stopping_threshold: 'ALT > 3x ULN concurrent with Bilirubin > 2x ULN (FDA Hy\'s Law)',
        dosing_rules: 'Fixed 50 mg orally once daily with morning meal',
        visit_window: '+/- 3 calendar days'
      },
      {
        version: 2,
        effective_cuts: 'Cut 4 - Cut 7',
        status: pVer === 2 ? 'ACTIVE' : (pVer > 2 ? 'SUPERSEDED' : 'PLANNED_AMENDMENT'),
        amendment_summary: 'Protocol Amendment 1: Safety threshold revised to ALT > 5x ULN based on external pharmacokinetic data; Secondary biomarker cohort expanded.',
        safety_stopping_threshold: 'ALT > 5x ULN concurrent with Bilirubin > 2x ULN',
        dosing_rules: '50 mg orally once daily',
        visit_window: '+/- 3 calendar days'
      },
      {
        version: 3,
        effective_cuts: 'Cut 8 - Cut 12',
        status: pVer === 3 ? 'ACTIVE' : 'PLANNED_CLOSEOUT',
        amendment_summary: 'Protocol Amendment 2: Final trial closeout and secondary biomarker endpoint analysis.',
        safety_stopping_threshold: 'ALT > 5x ULN concurrent with Bilirubin > 2x ULN',
        dosing_rules: '50 mg orally once daily',
        visit_window: '+/- 3 calendar days'
      }
    ]
  });
});

app.get('/api/audit', (req: Request, res: Response) => {
  res.json(runtimeState.auditLogs);
});

// 10. Public Clinical Data Integration (ClinicalTrials.gov Public API)
app.get('/api/public-data/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || 'diabetes';
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=5`;

  https.get(url, { headers: { 'User-Agent': 'TrialCoreIntelligence/1.0' } }, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        const formatted = (json.studies || []).map((s: any) => {
          const proto = s.protocolSection || {};
          const id = proto.identificationModule || {};
          const status = proto.statusModule || {};
          const design = proto.designModule || {};
          const elig = proto.eligibilityModule || {};
          return {
            nctId: id.nctId,
            briefTitle: id.briefTitle,
            officialTitle: id.officialTitle,
            overallStatus: status.overallStatus,
            phase: design.phases?.join(', ') || 'Phase 3',
            eligibilityCriteria: elig.eligibilityCriteria || '',
            retrievalTimestamp: new Date().toISOString(),
            source: 'NIH ClinicalTrials.gov Public REST API v2',
            license: 'U.S. National Library of Medicine Public Data'
          };
        });
        res.json({ count: formatted.length, studies: formatted });
      } catch (err: any) {
        res.status(500).json({ error: 'Failed parsing ClinicalTrials.gov API response', details: err.message });
      }
    });
  }).on('error', (err) => {
    res.status(502).json({ error: 'Unable to reach ClinicalTrials.gov API', details: err.message });
  });
});

app.post('/api/public-data/import', (req: Request, res: Response) => {
  const { study } = req.body;
  if (!study || !study.nctId) {
    return res.status(400).json({ error: 'Invalid study object' });
  }
  runtimeState.importedPublicStudies.unshift(study);
  runtimeState.auditLogs.unshift({
    event_id: `EVT_PUBLIC_IMPORT_${Date.now()}`,
    timestamp: new Date().toISOString(),
    cut: runtimeState.currentCut,
    actor: 'ClinicalTrialConnector',
    action: 'IMPORT_PUBLIC_TRIAL_DATA',
    details: { nctId: study.nctId, title: study.briefTitle, source: study.source }
  });
  res.json({
    success: true,
    message: `Successfully connected and imported protocol metadata for ${study.nctId}`,
    provenance: {
      source: 'ClinicalTrials.gov Public API v2',
      nctId: study.nctId,
      timestamp: new Date().toISOString(),
      license: 'Public Domain'
    }
  });
});

// Manual clinical record insertion API
app.post('/api/manual-insert-record', async (req: Request, res: Response) => {
  const { domain, subject_id, site, visit, date, cut, record } = req.body;
  if (!domain || !subject_id) {
    return res.status(400).json({ error: 'domain and subject_id are required' });
  }
  try {
    const cutNum = parseInt(cut) || runtimeState.currentCut;
    const result = await runPythonBridge('insert_record', {
      domain,
      subject_id,
      site: site || 'S01',
      visit: visit || 'WEEK4',
      date: date || new Date().toISOString().split('T')[0],
      cut: cutNum,
      record: record || {}
    });

    runtimeState.auditLogs.unshift({
      event_id: `EVT_MANUAL_INSERT_${Date.now()}`,
      timestamp: new Date().toISOString(),
      cut: cutNum,
      actor: 'ClinicalDataManager',
      action: 'MANUAL_RECORD_INSERT',
      details: {
        record_id: result.record_id,
        domain,
        subject_id,
        site: site || 'S01',
        cut: cutNum
      }
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// File upload / custom de-identified data ingestion
app.post('/api/upload-dataset', async (req: Request, res: Response) => {
  const { filename, content, domain, cut } = req.body;
  if (!filename || !content) {
    return res.status(400).json({ error: 'filename and content are required' });
  }
  try {
    const cutNum = parseInt(cut) || runtimeState.currentCut;
    const result = await runPythonBridge('ingest_file', {
      filename,
      content,
      cut: cutNum,
      domain: domain || ''
    });

    runtimeState.auditLogs.unshift({
      event_id: `EVT_UPLOAD_${Date.now()}`,
      timestamp: new Date().toISOString(),
      cut: cutNum,
      actor: 'DataReviewer',
      action: 'INGEST_CUSTOM_DATASET',
      details: {
        filename,
        rows_ingested: result.rows_ingested,
        domain: result.domain,
        cut: cutNum
      }
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset simulation
app.post('/api/reset', async (req: Request, res: Response) => {
  runtimeState.currentCut = 3;
  runtimeState.queries = [];
  runtimeState.escalations = [];
  runtimeState.lastWatchReport = null;
  runtimeState.lastBenchmarkResult = null;
  runtimeState.lastGeneratedReport = null;
  runtimeState.auditLogs = [{
    event_id: `EVT_RESET_${Date.now()}`,
    timestamp: new Date().toISOString(),
    cut: 3,
    actor: 'SystemAdmin',
    action: 'RESET_TRIAL_STATE',
    details: { message: 'Reset state to Cut 3 initial surveillance baseline.' }
  }];
  res.json({ success: true });
});

// Setup Vite or static serving
async function setupVite() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'))) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrialCore Intelligence server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
