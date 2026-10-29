
import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Lock,
  Globe,
  Bell,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  RefreshCw,
  Sliders,
  User,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export const SettingsView: React.FC = () => {
  const {
    currency,
    setCurrency,
    profile,
    user,
    setActiveTab,
    setIsCurrencyModalOpen,
    resetDemoDataset,
    isMfaEnabled,
    setIsMfaEnabled,
    isDemoMode,
    setIsDemoMode,
  } = useAuth();

  const [sessionTimeout, setSessionTimeout] = useState<number>(15);
  const [allowAiInference, setAllowAiInference] = useState<boolean>(true);
  const [allowAnomalyAlerts, setAllowAnomalyAlerts] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const handleSavePreferences = () => {
    setSaveSuccess('System preferences and security policies saved successfully.');
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const handleExportFullBackup = async () => {
    try {
      const data = await api.exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aegis-financial-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Failed to export backup: ' + e.message);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          System Settings & Security Configuration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage currency localization, session policies, AI intelligence toggles, and cryptographic keys
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">User Identity & KYC Tier</h2>
                  <p className="text-[11px] text-slate-500">
                    Account level, verified email, and compliance identity
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                KYC LEVEL 2 (VERIFIED)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  disabled
                  value={user?.name || 'Alex Morgan'}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Primary Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || 'alex.morgan@fintech.io'}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('kyc')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Open Identity & KYC Portal</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Localization & Default Currency</h2>
                  <p className="text-[11px] text-slate-500">
                    Global currency formatting and date convention settings
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCurrencyModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <span>Calculator</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="INR">₹ Indian Rupee (INR)</option>
                  <option value="USD">$ US Dollar (USD)</option>
                  <option value="EUR">€ Euro (EUR)</option>
                  <option value="GBP">£ British Pound (GBP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Session Auto-Lock Timeout
                </label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={5}>5 Minutes of Inactivity</option>
                  <option value={15}>15 Minutes of Inactivity</option>
                  <option value={30}>30 Minutes of Inactivity</option>
                  <option value={60}>1 Hour of Inactivity</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Explainable AI (XAI) Privacy Controls</h2>
                <p className="text-[11px] text-slate-500">
                  Granular control over ML model inference, OCR parsing, and anomaly surveillance
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Enable Real-time Spending Category Inference
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Predicts merchant categories and tags transactions upon creation
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowAiInference}
                  onChange={(e) => setAllowAiInference(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Proactive Statistical Anomaly Alerts
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Flags sudden price spikes or duplicate subscription charges in real-time
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowAnomalyAlerts}
                  onChange={(e) => setAllowAnomalyAlerts(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Multi-Factor Security (MFA)
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Require cryptographic TOTP verification or passkey whenever signing in or modifying budget rules.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-800">TOTP Authenticator</span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {isMfaEnabled ? 'Status: Active (Enforced)' : 'Status: Disabled'}
                </span>
              </div>
              <button
                onClick={() => setIsMfaEnabled(!isMfaEnabled)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isMfaEnabled
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isMfaEnabled ? 'Disable' : 'Enable MFA'}
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Fabric Ledger Node
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Channel Name:</span>
                <span className="font-mono font-semibold text-slate-800">fintech-audit-channel</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Org MSP:</span>
                <span className="font-mono font-semibold text-slate-800">FinTechOrgMSP</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Consensus Engine:</span>
                <span className="font-mono text-emerald-600 font-semibold">Raft (3/3 Nodes Active)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Hash Algorithm:</span>
                <span className="font-mono font-semibold text-slate-800">SHA-256</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Data Management & Backup
            </h3>

            <button
              onClick={handleExportFullBackup}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Export Full Encrypted JSON Backup</span>
            </button>

            <button
              onClick={resetDemoDataset}
              className="w-full p-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-rose-600" />
              <span>Reset to Clean Demo Dataset</span>
            </button>
          </div>

          <button
            onClick={handleSavePreferences}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Security & App Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
