import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Target,
  BrainCircuit,
  BarChart3,
  ShieldCheck,
  Lock,
  FileText,
  Settings,
  Sparkles,
  X,
  Building2,
  Calendar,
  Flame,
  TrendingDown,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth, NavigationTab } from '../../context/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { activeTab, setActiveTab } = useAuth();

  const accountItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts', label: 'Accounts & Sandbox', icon: Building2 },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'import', label: 'Import Statement / CSV', icon: FileSpreadsheet },
  ];

  const payablesItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: 'calendar', label: 'Financial Calendar', icon: Calendar },
    { id: 'bills', label: 'Bills & Utilities', icon: Receipt },
    { id: 'subscriptions', label: 'Subscriptions', icon: Flame },
    { id: 'debt', label: 'Debt & Loans', icon: TrendingDown },
    { id: 'receipts', label: 'Receipt Vault', icon: Receipt },
  ];

  const intelligenceItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'budgets', label: 'Budgets', icon: PiggyBank },
    { id: 'goals', label: 'Savings Goals', icon: Target },
    { id: 'insights', label: 'AI Intelligence', icon: BrainCircuit },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const securityItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: 'blockchain', label: 'Blockchain Audit', icon: ShieldCheck },
    { id: 'security', label: 'Security & Privacy', icon: Lock },
    { id: 'kyc', label: 'Identity & KYC', icon: ShieldCheck },
    { id: 'reports', label: 'Financial Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderNavGroup = (items: typeof accountItems) => (
    <div className="space-y-0.5">
      {items.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              if (onClose) onClose();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              isActive
                ? 'bg-slate-900 text-white font-medium shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-200 lg:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900 text-sm">AegisFinance</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
          <div>
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Banking & Accounts
            </div>
            {renderNavGroup(accountItems)}
          </div>

          <div>
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Obligations & Debt
            </div>
            {renderNavGroup(payablesItems)}
          </div>

          <div>
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              AI & Financial Planning
            </div>
            {renderNavGroup(intelligenceItems)}
          </div>

          <div>
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Security & Audit
            </div>
            {renderNavGroup(securityItems)}
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                Fabric Peer v2.5
              </span>
              <span className="font-mono text-[10px] text-slate-400">2/2 Peers</span>
            </div>

            <div className="space-y-1 text-[10px] text-slate-500 font-mono">
              <div className="flex justify-between">
                <span>Ledger Channel:</span>
                <span className="text-slate-800">fintech-audit</span>
              </div>
              <div className="flex justify-between">
                <span>Off-Chain Data:</span>
                <span className="text-emerald-700 font-semibold">AES-256 GCM</span>
              </div>
              <div className="flex justify-between">
                <span>PII on Chain:</span>
                <span className="text-emerald-700 font-semibold">0% (Hashes Only)</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
