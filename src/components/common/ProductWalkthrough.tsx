import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Building2,
  Receipt,
  ShieldCheck,
  BrainCircuit,
  PiggyBank,
} from 'lucide-react';
import { useAuth, NavigationTab } from '../../context/AuthContext';

interface WalkthroughStep {
  title: string;
  tab: NavigationTab;
  badge: string;
  description: string;
  keyFeature: string;
  icon: React.ElementType;
}

const STEPS: WalkthroughStep[] = [
  {
    title: 'Depository Balances & Sandbox Connector',
    tab: 'accounts',
    badge: 'Step 1 of 5',
    description: 'Explore live depository accounts, credit cards, and UPI cash positions. Connect to the Synthetic Bank Sandbox to simulate transaction ingestion without real credentials.',
    keyFeature: 'Multi-account asset/liability position calculation with live Fabric ledger anchoring.',
    icon: Building2,
  },
  {
    title: 'Ledger Reconciliation & Search Filters',
    tab: 'transactions',
    badge: 'Step 2 of 5',
    description: 'Review the high-density transaction ledger. Every entry features machine learning classification, confidence scores, and an immutable blockchain state hash.',
    keyFeature: 'Fixed-width tabular columns with zero horizontal collisions and strict tenant scoping.',
    icon: Receipt,
  },
  {
    title: 'Cryptographic Merkle Proof Audit',
    tab: 'blockchain',
    badge: 'Step 3 of 5',
    description: 'Verify tamper-evident block headers. Each block encapsulates chronological transaction hashes into an RFC-6962 Merkle tree with one-click full chain verification.',
    keyFeature: 'Interactive Tamper Simulation Lab demonstrating zero tolerance for silent database alteration.',
    icon: ShieldCheck,
  },
  {
    title: 'Explainable AI & Horizon Forecasting',
    tab: 'insights',
    badge: 'Step 4 of 5',
    description: 'Inspect statistical anomaly detection (Z-Score & Median Absolute Deviation) alongside multi-horizon cash flow projections with transparent SHAP attributions.',
    keyFeature: 'Interactive What-If simulation engine predicting cash reserves and risk levels.',
    icon: BrainCircuit,
  },
  {
    title: 'Monthly Budget Planning & Threshold Controls',
    tab: 'budgets',
    badge: 'Step 5 of 5',
    description: 'Configure category caps and automated threshold alerts (Normal, High, Exceeded). The daily burn rate calculator projects month-end variance in real time.',
    keyFeature: 'Early risk alerts preventing unexpected category overdrafts.',
    icon: PiggyBank,
  },
];

interface ProductWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductWalkthrough: React.FC<ProductWalkthroughProps> = ({ isOpen, onClose }) => {
  const { setActiveTab } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const Icon = currentStep.icon;

  const handleGoToStep = (index: number) => {
    setCurrentStepIndex(index);
    setActiveTab(STEPS[index].tab);
  };

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      handleGoToStep(currentStepIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      handleGoToStep(currentStepIndex - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Interactive Product Walkthrough</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {currentStep.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Live tour navigating real functional modules</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">{currentStep.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{currentStep.description}</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Core Architectural Capability:</span> {currentStep.keyFeature}
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => handleGoToStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStepIndex ? 'w-8 bg-slate-900' : 'w-2 bg-slate-200 hover:bg-slate-300'
                }`}
                title={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
          >
            <span>{currentStepIndex === STEPS.length - 1 ? 'Finish Tour' : 'Next Step'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
