import React, { useState } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  CheckCircle,
  Shield,
  Layers,
  Lock,
  Clock,
  ArrowRight,
  Sliders,
  ShieldAlert,
  Brain
} from 'lucide-react';

interface JudgeWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'overview' | 'atlas' | 'patient360' | 'monitor' | 'watch') => void;
  onTriggerBenchmark?: () => void;
}

export const JudgeWalkthrough: React.FC<JudgeWalkthroughProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onTriggerBenchmark,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < 3) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if (nextStep === 2) onNavigateTab('monitor');
      if (nextStep === 3) onNavigateTab('watch');
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      if (prevStep === 1) onNavigateTab('atlas');
      if (prevStep === 2) onNavigateTab('monitor');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white border-2 border-emerald-500 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

        {/* Top Header & Step Badge */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shadow-xs">
              <Sparkles className="w-4 h-4 text-emerald-700" />
            </span>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                JUDGE PRESENTATION MODE • 60-SECOND DEMO
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                Step {currentStep} of 3
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
            title="Exit Demo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-900 font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <Brain className="w-4 h-4 text-emerald-600" />
              STAGE 1: ATLAS • KNOWLEDGE GRAPH & EVIDENCE ENGINE
            </div>
            <h2 className="text-xl font-black text-slate-950 tracking-tight">
              Evidence-Backed Clinical Question Answering
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Ask Atlas converts natural clinical questions into deterministic, verifiable answers over a connected
              Patient 360 knowledge graph. Zero hallucination: every positive or negative answer is strictly bound to
              verifiable source records (DM, LB, AE, EX, VS, DS).
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
              <div className="text-slate-900 font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Key Capabilities Highlighted:
              </div>
              <ul className="space-y-1.5 text-slate-600 pl-6 list-disc">
                <li>Connected Patient 360 graph linking demographic, visit, laboratory, and adverse-event nodes.</li>
                <li>COUNT, LOOKUP, FINDING, and TRAP queries with calculation traces.</li>
                <li>1-Click Automated Benchmark Runner verifying 100% compliance.</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  onNavigateTab('atlas');
                  if (onTriggerBenchmark) onTriggerBenchmark();
                }}
                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-emerald-800 text-emerald-800" />
                Run Live Benchmark Demonstration
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-teal-900 font-mono bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              <Sliders className="w-4 h-4 text-teal-600" />
              STAGE 2: MONITOR • 6-NODE REVIEW PIPELINE
            </div>
            <h2 className="text-xl font-black text-slate-950 tracking-tight">
              Rigorous Review with Mandatory Human Gating
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Findings flow through 6 sequential nodes: Detect → Medical Review → Data Manager → Compliance → Human Gate → Execute.
              Data errors (like laboratory notation issues) are isolated from clinical signals (like drug-induced liver injury).
            </p>

            {/* 6 Node Sequential Graphic */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-[10px] font-mono font-bold">
              {[
                { name: '1. Detect', color: 'bg-emerald-50 border-emerald-300 text-emerald-900' },
                { name: '2. Medical', color: 'bg-teal-50 border-teal-300 text-teal-900' },
                { name: '3. Data Mgr', color: 'bg-indigo-50 border-indigo-300 text-indigo-900' },
                { name: '4. Comply', color: 'bg-amber-50 border-amber-300 text-amber-900' },
                { name: '5. Human Gate', color: 'bg-rose-100 border-rose-400 text-rose-950 ring-2 ring-rose-400/40' },
                { name: '6. Execute', color: 'bg-emerald-50 border-emerald-300 text-emerald-900' },
              ].map((n) => (
                <div key={n.name} className={`p-2 rounded-xl border ${n.color}`}>
                  {n.name}
                </div>
              ))}
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1 text-xs">
              <div className="text-rose-900 font-black flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600" />
                Critical Clinical Safety Guarantee:
              </div>
              <p className="text-rose-800 text-xs">
                "Critical clinical decisions are never silently auto-approved. Silence is NOT consent. A human Medical Monitor must explicitly review evidence before trial holds are dispatched."
              </p>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-900 font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <ShieldAlert className="w-4 h-4 text-emerald-700" />
              STAGE 3: WATCH • 12-CUT LONGITUDINAL SURVEILLANCE
            </div>
            <h2 className="text-xl font-black text-slate-950 tracking-tight">
              Continuous Surveillance & Adversarial Defense
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Surveillance spans 12 sequential data cuts. Incremental graph updates ingest newly onboarded sites and domains
              while adversarial defense detects invariant site data, laboratory unit corruption, and protocol tampering.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs font-mono">
              <div className="text-slate-900 font-bold">12-Cut Surveillance Capabilities:</div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>• Adversarial Site Regularity (S04)</div>
                <div>• Lab Unit Notation Corruption (S02)</div>
                <div>• Retracting Corrections (042-S05-003)</div>
                <div>• Document Prompt Injection Defense</div>
                <div>• Protocol Evolution (v1.0 → v2.0 → v3.0)</div>
                <div>• Model & Time Budget Enforced</div>
              </div>
            </div>

            <div className="bg-emerald-900 text-emerald-100 p-4 rounded-2xl font-mono text-center font-bold text-sm tracking-wide shadow-md">
              From raw clinical data → evidence → decision → safety action.
            </div>
          </div>
        )}

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs font-semibold">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition"
          >
            Skip Walkthrough
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-emerald-700/20"
            >
              <span>{currentStep === 3 ? 'Finish Walkthrough' : 'Next Stage'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
