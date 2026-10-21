import React, { useState } from 'react';
import { Database, RefreshCw, CheckCircle2, Shield, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const DemoBanner: React.FC = () => {
  const { resetDemoDataset } = useAuth();
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await resetDemoDataset();
      setToastMsg('Synthetic dataset reset to default 3-month baseline.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch {
      setToastMsg('Failed to reset dataset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 relative z-30">
      <div className="flex items-center gap-2.5">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
        </span>
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-semibold border border-indigo-200">
            DEMO MODE
          </span>
          <span className="text-slate-700">Synthetic Demo Dataset (March – August 2026)</span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-slate-500 hover:text-slate-800 underline decoration-slate-400 underline-offset-2 flex items-center gap-1"
        >
          <Info className="w-3 h-3" />
          <span>Architecture Specs</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {toastMsg && (
          <span className="text-emerald-700 flex items-center gap-1 text-[11px] animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {toastMsg}
          </span>
        )}
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Reload 6-Month Dataset</span>
        </button>
      </div>

      {/* Expandable Architecture Explainer Drawer */}
      {showDetails && (
        <div className="w-full mt-2 p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-800 font-medium">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <Shield className="w-3.5 h-3.5" />
              Production Architecture & Evaluation Guide
            </span>
            <button onClick={() => setShowDetails(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="leading-relaxed">
            This live system integrates three core tiers:
            <strong className="text-slate-900"> AI/ML Layer</strong> (Multi-algorithm anomaly detection, time-series spending forecast with confidence bands, grounded categorization),
            <strong className="text-slate-900"> Off-Chain Private Ledger DB</strong> (tenant-isolated financial state, strict cryptographic privacy controls), and
            <strong className="text-slate-900"> Permissioned Blockchain Adapter</strong> (Hyperledger Fabric-compatible ledger simulation anchoring canonical SHA-256 digests and audit logs).
          </p>
        </div>
      )}
    </div>
  );
};
