import React, { useRef, useEffect } from 'react';
import {
  PlusCircle,
  CreditCard,
  PieChart,
  Target,
  Receipt,
  FileSpreadsheet,
  Camera,
  Calendar,
  Sparkles,
  ShieldCheck,
  Globe,
  DollarSign,
  ArrowRight,
  TrendingDown,
  Repeat,
} from 'lucide-react';
import { useAuth, NavigationTab } from '../../context/AuthContext';

interface GlobalQuickActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCurrencyModal?: () => void;
}

export const GlobalQuickActionMenu: React.FC<GlobalQuickActionMenuProps> = ({
  isOpen,
  onClose,
  onOpenCurrencyModal,
}) => {
  const {
    setActiveTab,
    setIsAddTxModalOpen,
    setIsReceiptModalOpen,
  } = useAuth();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (callback: () => void) => {
    callback();
    onClose();
  };

  const actions = [
    {
      title: 'Add Transaction',
      description: 'Record an income or expense with AI category prediction',
      icon: PlusCircle,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      action: () => setIsAddTxModalOpen(true),
    },
    {
      title: 'Scan Receipt (OCR)',
      description: 'Capture receipt photo with offline Tesseract OCR extraction',
      icon: Camera,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      action: () => setIsReceiptModalOpen(true),
    },
    {
      title: 'Import Bank Statement',
      description: 'Upload CSV or load sample statement into SQLite ledger',
      icon: FileSpreadsheet,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      action: () => setActiveTab('import'),
    },
    {
      title: 'Add Financial Account',
      description: 'Connect bank account, credit card, wallet, or cash register',
      icon: CreditCard,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      action: () => setActiveTab('accounts'),
    },
    {
      title: 'Set Monthly Budget',
      description: 'Configure category limits and proactive threshold alerts',
      icon: PieChart,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      action: () => setActiveTab('budgets'),
    },
    {
      title: 'Create Savings Goal',
      description: 'Track milestones with automatic target date projections',
      icon: Target,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      action: () => setActiveTab('goals'),
    },
    {
      title: 'Add Scheduled Bill',
      description: 'Register upcoming utility, rent, or maintenance obligations',
      icon: Calendar,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      action: () => setActiveTab('bills'),
    },
    {
      title: 'Track Subscription',
      description: 'Monitor recurring streaming, SaaS, and cloud memberships',
      icon: Repeat,
      color: 'text-violet-600 bg-violet-50 border-violet-200',
      action: () => setActiveTab('subscriptions'),
    },
    {
      title: 'Register Loan / EMI',
      description: 'Compute debt amortization schedules and interest breakdown',
      icon: TrendingDown,
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      action: () => setActiveTab('loans'),
    },
    {
      title: 'Identity Verification (KYC)',
      description: 'Complete demo document verification with blockchain audit trail',
      icon: ShieldCheck,
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      action: () => setActiveTab('kyc' as any),
    },
    {
      title: 'Currency Converter',
      description: 'Live & simulated multi-currency foreign exchange rates',
      icon: Globe,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      action: () => onOpenCurrencyModal && onOpenCurrencyModal(),
    },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-50 divide-y divide-slate-100"
    >
      <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-b border-slate-100">
        <div>
          <div className="text-xs font-bold text-slate-800">Quick Actions</div>
          <div className="text-[10px] text-slate-500">Create, import, scan, or navigate in 1-click</div>
        </div>
        <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-400 font-semibold shadow-2xs">
          ESC
        </kbd>
      </div>

      <div className="max-h-[380px] overflow-y-auto p-1.5 space-y-0.5">
        {actions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => handleAction(item.action)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-left transition-colors group cursor-pointer"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${item.color} shadow-2xs group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                  <span>{item.title}</span>
                  <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                </div>
                <div className="text-[10px] text-slate-500 truncate">{item.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
