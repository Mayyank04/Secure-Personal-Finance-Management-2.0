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
    badge?: string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts', label: 'Accounts & Sandbox', icon: Building2, badge: 'Demo' },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'import', label: 'Import Statement / CSV', icon: FileSpreadsheet },
  ];

  const payablesItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[] = [
    { id: 'calendar', label: 'Financial Calendar', icon: Calendar, badge: 'ICS' },
    { id: 'bills', label: 'Bills & Utilities', icon: Receipt },
    { id: 'subscriptions', label: 'Subscriptions', icon: Flame, badge: 'Burn' },
    { id: 'debt', label: 'Debt & Loans', icon: TrendingDown },
    { id: 'receipts', label: 'Receipt Vault', icon: Receipt, badge: 'OCR' },
  ];

  const intelligenceItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[] = [
    { id: 'assistant', label: 'AI Assistant', icon: Sparkles, badge: 'Copilot' },
    { id: 'budgets', label: 'Budgets', icon: PiggyBank },
    { id: 'goals', label: 'Savings Goals', icon: Target },
    { id: 'insights', label: 'AI Intelligence', icon: BrainCircuit, badge: 'XAI' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const securityItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[] = [
    { id: 'blockchain', label: 'Blockchain Audit', icon: ShieldCheck, badge: 'Fabric' },
    { id: 'security', label: 'Security & Privacy', icon: Lock },
    { id: 'kyc', label: 'Identity & KYC', icon: ShieldCheck, badge: 'Demo' },
    { id: 'reports', label: 'Financial Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderNavGroup = (items: typeof accountItems) => (
    <div className="space-y-1">
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
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </div>
            {item.badge && (
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono border shrink-0 ${
                  item.badge === 'OCR'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : item.badge === 'Burn'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : item.badge === 'XAI'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : item.badge === 'Demo'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header in mobile */}
        <div className="p-4 flex items-center justify-between border-b border-slate-200 md:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900 text-sm">AegisFinance</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
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

        {/* Bottom Blockchain Status Panel */}
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
