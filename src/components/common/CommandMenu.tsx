
import React, { useState, useEffect } from 'react';
import {
  Search,
  PlusCircle,
  Camera,
  Mic,
  Sparkles,
  ShieldCheck,
  FileText,
  PieChart,
  Target,
  Layers,
  Settings,
  X,
  ArrowRight,
  TrendingUp,
  CreditCard,
  RotateCcw,
} from 'lucide-react';
import { useAuth, NavigationTab } from '../../context/AuthContext';

export const CommandMenu: React.FC = () => {
  const {
    isCommandMenuOpen,
    setIsCommandMenuOpen,
    setActiveTab,
    setIsReceiptModalOpen,
    setIsVoiceModalOpen,
    setIsAddTxModalOpen,
    setIsChatOpen,
    resetDemoDataset,
  } = useAuth();

  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandMenuOpen(!isCommandMenuOpen);
      }
      if (e.key === 'Escape' && isCommandMenuOpen) {
        setIsCommandMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandMenuOpen, setIsCommandMenuOpen]);

  if (!isCommandMenuOpen) return null;

  const quickActions = [
    {
      label: 'Add New Transaction',
      subtitle: 'Manual expense or income entry',
      icon: PlusCircle,
      action: () => {
        setIsCommandMenuOpen(false);
        setIsAddTxModalOpen(true);
      },
    },
    {
      label: 'Scan Receipt (OCR)',
      subtitle: 'Extract data from invoice or receipt image',
      icon: Camera,
      action: () => {
        setIsCommandMenuOpen(false);
        setIsReceiptModalOpen(true);
      },
    },
    {
      label: 'Voice Expense Entry',
      subtitle: 'Record transaction via speech recognition',
      icon: Mic,
      action: () => {
        setIsCommandMenuOpen(false);
        setIsVoiceModalOpen(true);
      },
    },
    {
      label: 'Ask AI Financial Assistant',
      subtitle: 'Grounded copilot spending & budget query',
      icon: Sparkles,
      action: () => {
        setIsCommandMenuOpen(false);
        setActiveTab('assistant');
      },
    },
    {
      label: 'Audit Blockchain Ledger',
      subtitle: 'Cryptographic block verification & hash checks',
      icon: ShieldCheck,
      action: () => {
        setIsCommandMenuOpen(false);
        setActiveTab('blockchain');
      },
    },
    {
      label: 'Generate Monthly Statement',
      subtitle: 'View cryptographic sealed financial report',
      icon: FileText,
      action: () => {
        setIsCommandMenuOpen(false);
        setActiveTab('reports');
      },
    },
  ];

  const navigationItems: { label: string; tab: NavigationTab; icon: any }[] = [
    { label: 'Overview Dashboard', tab: 'dashboard', icon: TrendingUp },
    { label: 'Transactions & Ledger', tab: 'transactions', icon: CreditCard },
    { label: 'AI Assistant (Copilot)', tab: 'assistant', icon: Sparkles },
    { label: 'Budgets & Envelopes', tab: 'budgets', icon: PieChart },
    { label: 'Savings Goals', tab: 'goals', icon: Target },
    { label: 'AI Insights & Forecasts', tab: 'insights', icon: Sparkles },
    { label: 'Advanced Analytics', tab: 'analytics', icon: Layers },
    { label: 'Blockchain Audit Explorer', tab: 'blockchain', icon: ShieldCheck },
    { label: 'Security & Privacy Center', tab: 'security', icon: ShieldCheck },
    { label: 'Reports & Statements', tab: 'reports', icon: FileText },
    { label: 'Settings & Preferences', tab: 'settings', icon: Settings },
  ];

  const filteredActions = quickActions.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const filteredNav = navigationItems.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, navigate pages, or execute quick actions..."
            className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          <button
            onClick={() => setIsCommandMenuOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 overflow-y-auto space-y-4 max-h-[420px]">
          {filteredActions.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Quick Actions
              </div>
              <div className="space-y-1 mt-1">
                {filteredActions.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={i}
                      onClick={action.action}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 border border-transparent transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600">
                            {action.label}
                          </p>
                          <p className="text-[11px] text-slate-400">{action.subtitle}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredNav.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pages & Dashboards
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                {filteredNav.map((nav, i) => {
                  const Icon = nav.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveTab(nav.tab);
                        setIsCommandMenuOpen(false);
                      }}
                      className="text-left p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all flex items-center gap-2.5 group"
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                      <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600">
                        {nav.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-mono shadow-xs">
                ESC
              </kbd>{' '}
              to close
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-mono shadow-xs">
                ↑↓
              </kbd>{' '}
              to navigate
            </span>
          </div>
          <span className="text-slate-500 font-medium">FinTech Command Engine</span>
        </div>
      </div>
    </div>
  );
};
