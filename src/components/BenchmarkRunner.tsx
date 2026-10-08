import React, { useState } from 'react';
import {
  Play,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Cpu,
  Clock,
  Eye,
  FileText,
  AlertTriangle,
  ChevronRight,
  Database,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

interface BenchmarkItem {
  category: 'COUNT' | 'LOOKUP' | 'FINDING' | 'TRAP';
  title: string;
  question: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  execution_time_ms: number;
  evidence_count: number;
  evidence: any[];
  calculation?: any;
  source_domains: string[];
  note?: string;
}

interface BenchmarkSuiteResult {
  overall_status: 'PASS' | 'FAIL';
  overall_compliance: string;
  zero_hallucination_score: string;
  hys_law_detection: string;
  date_window_accuracy: string;
  evidence_traceability: string;
  cut_aware_retrieval: string;
  total_execution_time_ms: number;
  total_evidence_count: number;
  data_cut_evaluated: number;
  benchmarks: BenchmarkItem[];
}

interface BenchmarkRunnerProps {
  currentCut: number;
  onSelectEvidence?: (record: any) => void;
  onBenchmarkComplete?: (result: BenchmarkSuiteResult) => void;
}

export const BenchmarkRunner: React.FC<BenchmarkRunnerProps> = ({
  currentCut,
  onSelectEvidence,
  onBenchmarkComplete,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTestIndex, setActiveTestIndex] = useState<number>(-1);
  const [result, setResult] = useState<BenchmarkSuiteResult | null>(null);
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<BenchmarkItem | null>(null);

  const runBenchmarkSuite = async () => {
    setIsRunning(true);
    setResult(null);

    // Simulate short visual steps for presentation rhythm
    setActiveTestIndex(0); // COUNT
    await new Promise((r) => setTimeout(r, 180));
    setActiveTestIndex(1); // LOOKUP
    await new Promise((r) => setTimeout(r, 180));
    setActiveTestIndex(2); // FINDING
    await new Promise((r) => setTimeout(r, 220));
    setActiveTestIndex(3); // TRAP
    await new Promise((r) => setTimeout(r, 150));

    try {
      const res = await fetch('/api/benchmark/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cut: currentCut }),
      });
      const data: BenchmarkSuiteResult = await res.json();
      setResult(data);
      if (onBenchmarkComplete) onBenchmarkComplete(data);
    } catch (err) {
      console.error('Benchmark execution error:', err);
    } finally {
      setIsRunning(false);
      setActiveTestIndex(-1);
    }
  };

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-5 md:p-6 space-y-6 shadow-sm">
      {/* Header with prominent Run Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-semibold mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Deterministic Clinical Evidence Suite
          </div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            1-Click Regulatory Benchmark Suite
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Executes all 4 core query archetypes (COUNT, LOOKUP, FINDING, TRAP) against live STUDY-042 dataset.
          </p>
        </div>

        <button
          onClick={runBenchmarkSuite}
          disabled={isRunning}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-md ${
            isRunning
              ? 'bg-emerald-500 text-white cursor-wait opacity-80'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20 active:scale-98'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Evaluating Deterministic Pipeline...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Run Automated Benchmark Suite</span>
            </>
          )}
        </button>
      </div>

      {/* Progress animation during run */}
      {isRunning && (
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-emerald-900 font-mono font-semibold">
            <span>Executing deterministic query pipeline...</span>
            <span>Step {activeTestIndex + 1} of 4</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'COUNT', sub: 'Discontinuations' },
              { label: 'LOOKUP', sub: 'Date Window' },
              { label: 'FINDING', sub: "Hy's Law Detection" },
              { label: 'TRAP', sub: 'Zero Hallucination' },
            ].map((step, idx) => (
              <div
                key={step.label}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  activeTestIndex === idx
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm scale-102'
                    : activeTestIndex > idx
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                <div className="text-[11px] font-bold font-mono">{step.label}</div>
                <div className="text-[10px] truncate">{step.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmark Scorecard Display */}
      {result && (
        <div className="space-y-5 animate-fadeIn">
          {/* Top Scorecard Banner */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border-2 border-emerald-500/40 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 font-mono">
                    REGULATORY BENCHMARK SUITE
                  </span>
                  <span className="bg-emerald-600 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                    {result.overall_status}
                  </span>
                </div>
                <div className="text-3xl font-black font-mono text-emerald-900 tracking-tight flex items-baseline gap-2">
                  <span>{result.overall_compliance}</span>
                  <span className="text-xs font-semibold text-slate-500 font-sans">
                    Overall Regulatory Compliance
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Evaluated across {result.total_evidence_count} verified evidence records in {result.total_execution_time_ms} ms (Cut {result.data_cut_evaluated}).
                </p>
              </div>

              {/* Verified Metrics Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
                  <div className="text-slate-500 text-[10px]">Zero Hallucination</div>
                  <div className="font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {result.zero_hallucination_score}
                  </div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
                  <div className="text-slate-500 text-[10px]">Hy's Law Detection</div>
                  <div className="font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {result.hys_law_detection}
                  </div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
                  <div className="text-slate-500 text-[10px]">Date Window Accuracy</div>
                  <div className="font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {result.date_window_accuracy}
                  </div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
                  <div className="text-slate-500 text-[10px]">Evidence Traceability</div>
                  <div className="font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {result.evidence_traceability}
                  </div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
                  <div className="text-slate-500 text-[10px]">Cut-Aware Retrieval</div>
                  <div className="font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {result.cut_aware_retrieval}
                  </div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
                  <div className="text-slate-500 text-[10px]">Execution Latency</div>
                  <div className="font-extrabold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {result.total_execution_time_ms} ms
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Compact Benchmark Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {result.benchmarks.map((b) => (
              <div
                key={b.category}
                className="bg-slate-50/70 hover:bg-emerald-50/30 border border-slate-200 hover:border-emerald-300 rounded-xl p-4 transition space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {b.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">{b.title}</h4>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      b.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {b.status === 'PASS' ? (
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-600" />
                    )}
                    {b.status}
                  </span>
                </div>

                <div className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200 font-sans">
                  "{b.question}"
                </div>

                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Expected:</span>
                    <span className="text-slate-800 font-semibold">{b.expected}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Actual:</span>
                    <span className="text-emerald-800 font-bold">{b.actual}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-500 font-mono">
                    <span>{b.execution_time_ms} ms</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">{b.evidence_count} evidence records</span>
                  </div>
                  <button
                    onClick={() => setActiveEvidenceModal(b)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Evidence
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Modal / Slide-over */}
      {activeEvidenceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-emerald-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  {activeEvidenceModal.category} BENCHMARK EVIDENCE
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-1">
                  {activeEvidenceModal.title}
                </h4>
              </div>
              <button
                onClick={() => setActiveEvidenceModal(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <span className="font-semibold text-emerald-900">Query: </span>
              {activeEvidenceModal.question}
            </div>

            {activeEvidenceModal.calculation && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1">
                <div className="text-teal-800 font-bold">{activeEvidenceModal.calculation.name}</div>
                <div className="text-slate-600">Formula: {activeEvidenceModal.calculation.formula}</div>
                <div className="text-slate-600">
                  Inputs: {JSON.stringify(activeEvidenceModal.calculation.inputs)}
                </div>
                <div className="text-emerald-700 font-bold">
                  Result: {String(activeEvidenceModal.calculation.result)}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2">
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                Source Records ({activeEvidenceModal.evidence.length})
              </h5>
              {activeEvidenceModal.evidence.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200">
                  Zero violating records in study dataset. Verified deterministic negative result without fabrication.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeEvidenceModal.evidence.map((ev: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-50 hover:bg-emerald-50/40 p-3 rounded-xl border border-slate-200 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="text-emerald-700 font-bold">{ev.record_id}</div>
                        <div className="text-slate-800 font-sans text-xs">
                          {ev.reason || `${ev.variable}: ${ev.value} ${ev.unit || ''}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Subject: {ev.subject_id} • Domain: {ev.domain} • File: {ev.source_file}
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono self-start sm:self-center">
                        {ev.visit || ev.date || 'Record'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveEvidenceModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded-lg text-slate-800 transition"
              >
                Close Evidence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
