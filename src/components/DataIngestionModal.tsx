import React, { useState } from 'react';
import {
  Upload,
  PlusCircle,
  FileText,
  CheckCircle,
  X,
  AlertTriangle,
  Database,
  ArrowRight,
  Layers,
  Sparkles,
  RefreshCw,
  Table,
  FileCode,
  ShieldCheck,
  User
} from 'lucide-react';

interface DataIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCut: number;
  availableSubjects: any[];
  onDataIngested: () => void;
}

export const DataIngestionModal: React.FC<DataIngestionModalProps> = ({
  isOpen,
  onClose,
  currentCut,
  availableSubjects,
  onDataIngested,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'paste'>('manual');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab 1: File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [uploadDomain, setUploadDomain] = useState<string>('auto');
  const [uploadCut, setUploadCut] = useState<number>(currentCut);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  // Tab 2: Manual Record Form State
  const [manualDomain, setManualDomain] = useState<string>('laboratory');
  const [manualSubjectId, setManualSubjectId] = useState<string>('042-S05-003');
  const [manualSite, setManualSite] = useState<string>('S05');
  const [manualVisit, setManualVisit] = useState<string>('WEEK4');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualCut, setManualCut] = useState<number>(currentCut);

  // Lab specifics
  const [labTest, setLabTest] = useState<string>('ALT');
  const [labValue, setLabValue] = useState<string>('42.0');
  const [labUnit, setLabUnit] = useState<string>('U/L');
  const [labUln, setLabUln] = useState<string>('45.0');

  // AE specifics
  const [aeTerm, setAeTerm] = useState<string>('Mild Nausea');
  const [aeSeverity, setAeSeverity] = useState<string>('Grade 1');
  const [aeSerious, setAeSerious] = useState<string>('N');
  const [aeAction, setAeAction] = useState<string>('None');

  // Dose specifics
  const [doseAmount, setDoseAmount] = useState<string>('50.0');
  const [dosePlanned, setDosePlanned] = useState<string>('50.0');
  const [doseWrong, setDoseWrong] = useState<string>('N');

  // Vital specifics
  const [vitalTest, setVitalTest] = useState<string>('Systolic Blood Pressure');
  const [vitalValue, setVitalValue] = useState<string>('120');
  const [vitalUnit, setVitalUnit] = useState<string>('mmHg');

  // Disposition specifics
  const [dispStatus, setDispStatus] = useState<string>('Ongoing');
  const [dispReason, setDispReason] = useState<string>('');

  // Tab 3: Paste Data State
  const [pastedText, setPastedText] = useState<string>('');
  const [pastedFilename, setPastedFilename] = useState<string>('manual_batch.csv');

  if (!isOpen) return null;

  // Handle file picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setFileContent(text);
      parsePreview(text);
    };
    reader.readAsText(file);
  };

  const parsePreview = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length > 0) {
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      setDetectedColumns(headers);
      const rows = lines.slice(1, 6).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = vals[idx] || '';
        });
        return obj;
      });
      setPreviewRows(rows);
    }
  };

  // Submit File Upload
  const handleUploadSubmit = async () => {
    if (!fileContent || !selectedFile) {
      setErrorMessage('Please select a CSV or JSON file to upload.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/upload-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          content: fileContent,
          domain: uploadDomain === 'auto' ? '' : uploadDomain,
          cut: uploadCut,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Dataset "${selectedFile.name}" successfully ingested (${data.rows_ingested} records).`);
        onDataIngested();
      } else {
        setErrorMessage(data.error || 'Failed to ingest dataset.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error during upload.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Single Manual Record
  const handleManualInsert = async () => {
    if (!manualSubjectId.trim()) {
      setErrorMessage('Subject ID is required.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let recordPayload: any = {};
    if (manualDomain === 'laboratory') {
      recordPayload = {
        test_name: labTest,
        value: parseFloat(labValue) || 0,
        unit: labUnit,
        uln: parseFloat(labUln) || 45.0,
      };
    } else if (manualDomain === 'adverse_events') {
      recordPayload = {
        event_term: aeTerm,
        severity: aeSeverity,
        is_serious: aeSerious,
        action_taken: aeAction,
      };
    } else if (manualDomain === 'doses') {
      recordPayload = {
        dose_amount: parseFloat(doseAmount) || 50.0,
        planned_dose: parseFloat(dosePlanned) || 50.0,
        wrong_dose: doseWrong,
      };
    } else if (manualDomain === 'vital_signs') {
      recordPayload = {
        test_name: vitalTest,
        value: parseFloat(vitalValue) || 120,
        unit: vitalUnit,
      };
    } else if (manualDomain === 'disposition') {
      recordPayload = {
        completion_status: dispStatus,
        reason_discontinued: dispReason,
      };
    }

    try {
      const res = await fetch('/api/manual-insert-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: manualDomain,
          subject_id: manualSubjectId,
          site: manualSite,
          visit: manualVisit,
          date: manualDate,
          cut: manualCut,
          record: recordPayload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Record ${data.record_id} successfully created and integrated into ${manualDomain} domain (Cut ${manualCut}).`);
        onDataIngested();
      } else {
        setErrorMessage(data.error || 'Failed to insert record.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inserting record.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Pasted Raw CSV
  const handlePastedSubmit = async () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste valid CSV or JSON text.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/upload-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: pastedFilename || 'manual_pasted_data.csv',
          content: pastedText,
          cut: currentCut,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Successfully parsed and inserted ${data.rows_ingested} records.`);
        onDataIngested();
      } else {
        setErrorMessage(data.error || 'Failed parsing pasted data.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing pasted text.');
    } finally {
      setLoading(false);
    }
  };

  const insertTemplate = (type: 'lab' | 'ae' | 'dose') => {
    if (type === 'lab') {
      setPastedFilename('custom_laboratory.csv');
      setPastedText(
        `record_id,usubjid,site,visit,visit_date,test_name,value,unit,uln,cut_available\n` +
        `LB_042-S05-004_WEEK4_ALT,042-S05-004,S05,WEEK4,2026-02-24,ALT,155.0,U/L,45.0,${currentCut}\n` +
        `LB_042-S05-004_WEEK4_BILI,042-S05-004,S05,WEEK4,2026-02-24,BILIRUBIN,2.7,mg/dL,1.2,${currentCut}\n` +
        `LB_042-S05-004_WEEK4_ALP,042-S05-004,S05,WEEK4,2026-02-24,ALP,88.0,U/L,120.0,${currentCut}`
      );
    } else if (type === 'ae') {
      setPastedFilename('custom_adverse_events.csv');
      setPastedText(
        `record_id,usubjid,site,visit,event_term,severity,is_serious,action_taken,date,cut_available\n` +
        `AE_042-S07-004_01,042-S07-004,S07,WEEK4,Hepatotoxicity Grade 2,Grade 2,N,Dose Interrupted,2026-02-18,${currentCut}`
      );
    } else if (type === 'dose') {
      setPastedFilename('custom_doses.csv');
      setPastedText(
        `record_id,usubjid,site,visit,dose_date,dose_amount,planned_dose,wrong_dose,cut_available\n` +
        `EX_042-S01-003_WEEK4,042-S01-003,S01,WEEK4,2026-02-24,50.0,50.0,N,${currentCut}`
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white border-2 border-emerald-500 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-emerald-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Upload & Insert Clinical Trial Data
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Manual record entry, CSV/JSON file ingestion, and custom dataset expansion
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-emerald-100 bg-emerald-50/40 text-xs font-bold font-mono px-4">
          <button
            onClick={() => {
              setActiveTab('manual');
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'border-emerald-600 text-emerald-900 font-extrabold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>1. Single Record Insert</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('upload');
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-900 font-extrabold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-teal-600" />
            <span>2. Upload CSV / JSON File</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('paste');
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'border-emerald-600 text-emerald-900 font-extrabold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4 text-indigo-600" />
            <span>3. Paste Raw Data</span>
          </button>
        </div>

        {/* Status Banners */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-100 border border-rose-300 text-rose-950 rounded-xl text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-white">
          {/* TAB 1: MANUAL RECORD INSERT */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Clinical Domain</label>
                  <select
                    value={manualDomain}
                    onChange={(e) => setManualDomain(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="laboratory">Laboratory (LB)</option>
                    <option value="adverse_events">Adverse Events (AE)</option>
                    <option value="doses">Exposure / Dosing (EX)</option>
                    <option value="vital_signs">Vital Signs (VS)</option>
                    <option value="disposition">Disposition (DS)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Subject ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualSubjectId}
                      onChange={(e) => {
                        setManualSubjectId(e.target.value);
                        // Auto-extract site if in format 042-S05-003
                        if (e.target.value.includes('-S')) {
                          const parts = e.target.value.split('-');
                          const sPart = parts.find((p) => p.startsWith('S'));
                          if (sPart) setManualSite(sPart.substring(0, 3));
                        }
                      }}
                      placeholder="e.g. 042-S05-004"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Site ID</label>
                  <select
                    value={manualSite}
                    onChange={(e) => setManualSite(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  >
                    {Array.from({ length: 12 }, (_, i) => `S${(i + 1).toString().padStart(2, '0')}`).map((s) => (
                      <option key={s} value={s}>
                        Site {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Visit Protocol</label>
                  <select
                    value={manualVisit}
                    onChange={(e) => setManualVisit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    {['SCREENING', 'BASELINE', 'WEEK2', 'WEEK4', 'WEEK6', 'WEEK8', 'WEEK10', 'WEEK12', 'UNSCHEDULED'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Collection / Event Date</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Cut Available (Cut 1 - 12)</label>
                  <select
                    value={manualCut}
                    onChange={(e) => setManualCut(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        Cut {c} {c === currentCut ? '(Current Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Domain Specific Inputs */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                  {manualDomain.toUpperCase()} Specific Measurements
                </div>

                {manualDomain === 'laboratory' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Test Name</label>
                      <select
                        value={labTest}
                        onChange={(e) => setLabTest(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      >
                        <option value="ALT">ALT</option>
                        <option value="AST">AST</option>
                        <option value="BILIRUBIN">BILIRUBIN</option>
                        <option value="ALP">ALP</option>
                        <option value="GLUCOSE">GLUCOSE</option>
                        <option value="CREATININE">CREATININE</option>
                        <option value="HEMOGLOBIN">HEMOGLOBIN</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Value</label>
                      <input
                        type="number"
                        step="any"
                        value={labValue}
                        onChange={(e) => setLabValue(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Unit</label>
                      <input
                        type="text"
                        value={labUnit}
                        onChange={(e) => setLabUnit(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">ULN (Norm High)</label>
                      <input
                        type="number"
                        step="any"
                        value={labUln}
                        onChange={(e) => setLabUln(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                  </div>
                )}

                {manualDomain === 'adverse_events' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="col-span-2">
                      <label className="text-slate-500 font-semibold mb-1 block">Event Term</label>
                      <input
                        type="text"
                        value={aeTerm}
                        onChange={(e) => setAeTerm(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                        placeholder="e.g. Severe Hepatotoxicity"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Severity</label>
                      <select
                        value={aeSeverity}
                        onChange={(e) => setAeSeverity(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      >
                        <option value="Grade 1">Grade 1</option>
                        <option value="Grade 2">Grade 2</option>
                        <option value="Grade 3">Grade 3</option>
                        <option value="Grade 4">Grade 4</option>
                        <option value="Grade 5">Grade 5</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Serious (SAE)?</label>
                      <select
                        value={aeSerious}
                        onChange={(e) => setAeSerious(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      >
                        <option value="N">No (N)</option>
                        <option value="Y">Yes (Y)</option>
                      </select>
                    </div>
                  </div>
                )}

                {manualDomain === 'doses' && (
                  <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Administered Dose (mg)</label>
                      <input
                        type="number"
                        step="any"
                        value={doseAmount}
                        onChange={(e) => setDoseAmount(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Planned Protocol Dose (mg)</label>
                      <input
                        type="number"
                        step="any"
                        value={dosePlanned}
                        onChange={(e) => setDosePlanned(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Protocol Dose Deviation?</label>
                      <select
                        value={doseWrong}
                        onChange={(e) => setDoseWrong(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      >
                        <option value="N">No Deviation (N)</option>
                        <option value="Y">Wrong Dose / Deviation (Y)</option>
                      </select>
                    </div>
                  </div>
                )}

                {manualDomain === 'vital_signs' && (
                  <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Vital Sign Test</label>
                      <input
                        type="text"
                        value={vitalTest}
                        onChange={(e) => setVitalTest(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Value</label>
                      <input
                        type="number"
                        step="any"
                        value={vitalValue}
                        onChange={(e) => setVitalValue(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Unit</label>
                      <input
                        type="text"
                        value={vitalUnit}
                        onChange={(e) => setVitalUnit(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                  </div>
                )}

                {manualDomain === 'disposition' && (
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Completion Status</label>
                      <select
                        value={dispStatus}
                        onChange={(e) => setDispStatus(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                      >
                        <option value="Ongoing">Ongoing</option>
                        <option value="Discontinued">Discontinued</option>
                        <option value="Completed Study Protocol">Completed Study Protocol</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold mb-1 block">Reason for Discontinuation</label>
                      <input
                        type="text"
                        value={dispReason}
                        onChange={(e) => setDispReason(e.target.value)}
                        placeholder="e.g. Adverse Event: Severe Hepatotoxicity"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleManualInsert}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 shadow-sm shadow-emerald-700/20"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Integrating into Knowledge Graph...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Insert Record into Clinical Graph</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD CSV / JSON FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/20 rounded-2xl p-6 text-center space-y-3 transition">
                <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
                <div>
                  <label className="cursor-pointer inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono shadow-xs transition">
                    <span>Browse CSV or JSON File</span>
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">
                    Accepts CDISC domains (DM, LB, AE, EX, VS, DS, CM, EG) or custom datasets.
                  </p>
                </div>
                {selectedFile && (
                  <div className="text-xs font-mono text-emerald-900 font-bold bg-white px-3 py-1.5 rounded-lg border border-emerald-200 inline-block">
                    Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Clinical Domain Target</label>
                  <select
                    value={uploadDomain}
                    onChange={(e) => setUploadDomain(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="auto">Auto-Detect from Filename / Headers</option>
                    <option value="laboratory">Laboratory (LB)</option>
                    <option value="adverse_events">Adverse Events (AE)</option>
                    <option value="doses">Exposure / Dosing (EX)</option>
                    <option value="vital_signs">Vital Signs (VS)</option>
                    <option value="subjects">Demographics (DM)</option>
                    <option value="disposition">Disposition (DS)</option>
                    <option value="custom">Custom Domain</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Target Surveillance Cut</label>
                  <select
                    value={uploadCut}
                    onChange={(e) => setUploadCut(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        Cut {c} {c === currentCut ? '(Current Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Preview Table */}
              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-700">Preview (First 5 Rows):</span>
                    <span className="text-slate-400">{detectedColumns.length} columns detected</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-44">
                    <table className="w-full text-[11px] text-left font-mono">
                      <thead className="bg-slate-100 text-slate-900 border-b border-slate-200 font-bold">
                        <tr>
                          {detectedColumns.map((col) => (
                            <th key={col} className="py-1.5 px-2.5 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {previewRows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            {detectedColumns.map((col) => (
                              <td key={col} className="py-1.5 px-2.5 whitespace-nowrap text-slate-700">
                                {row[col]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleUploadSubmit}
                  disabled={loading || !selectedFile}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 shadow-sm shadow-emerald-700/20"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Ingesting File...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Ingest Dataset into Study Graph</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PASTE RAW CSV / JSON */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">Quick Ingestion Templates:</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => insertTemplate('lab')}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 font-bold"
                  >
                    + Lab Rows
                  </button>
                  <button
                    onClick={() => insertTemplate('ae')}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 font-bold"
                  >
                    + AE Row
                  </button>
                  <button
                    onClick={() => insertTemplate('dose')}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-violet-50 border border-violet-200 text-violet-800 hover:bg-violet-100 font-bold"
                  >
                    + Dose Row
                  </button>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={pastedFilename}
                  onChange={(e) => setPastedFilename(e.target.value)}
                  placeholder="Target filename e.g. custom_records.csv"
                  className="w-full mb-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900"
                />
                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste CSV rows with header, or JSON array of clinical records..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handlePastedSubmit}
                  disabled={loading || !pastedText.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 shadow-sm shadow-emerald-700/20"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Parsing & Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <FileCode className="w-4 h-4" />
                      <span>Parse & Ingest Records</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
