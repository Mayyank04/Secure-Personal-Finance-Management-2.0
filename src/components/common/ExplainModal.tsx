import React from 'react';
import { Sparkles, BrainCircuit, Activity, Info, X, CheckCircle2 } from 'lucide-react';

interface ExplainModalProps {
  data: {
    title: string;
    explanation: string;
    signals: string[];
    action?: string;
  } | null;
  onClose: () => void;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Explainable AI (XAI) Insight</h3>
              <p className="text-xs text-slate-500">Signal Attribution & Model Reasoning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{data.title}</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{data.explanation}</p>
          </div>

          {/* Model Signals Used */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wider">
              <BrainCircuit className="w-4 h-4 text-indigo-600" />
              <span>Data Signals & Baselines Used</span>
            </div>
            <ul className="space-y-2">
              {data.signals.map((sig, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{sig}</span>
                </li>
              ))}
            </ul>
          </div>

          {data.action && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-indigo-950 font-semibold">Recommended User Action:</strong>
                <p className="mt-0.5 text-indigo-800">{data.action}</p>
              </div>
            </div>
          )}

          {/* Compliance & AI Disclaimer */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
            <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              This insight is generated algorithmically from your recorded private transactions. It represents mathematical patterns and does not constitute certified financial or legal counsel.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
