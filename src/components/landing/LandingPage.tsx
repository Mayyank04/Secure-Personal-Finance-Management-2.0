import React from 'react';
import {
  ShieldCheck,
  ArrowRight,
  Layers,
  Lock,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LandingPage: React.FC<{
  onEnterApp: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}> = ({ onEnterApp, onOpenTerms, onOpenPrivacy }) => {
  const { openAuthModal } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-indigo-500/20">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4 text-white stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-slate-900">
                  CipherLedger
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block">Secure Personal Finance System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openAuthModal('LOGIN')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onEnterApp}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>Launch Application</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 space-y-16">
        <div className="text-center space-y-5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium">
            <span>Cryptographically Verified Financial Operating System</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-semibold text-slate-900 tracking-tight leading-tight">
            Institutional Security for Personal Capital
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Tenant-isolated accounts, automated transaction categorization, statistical anomaly detection, and cryptographic SHA-256 Merkle ledger auditing.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onEnterApp}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition-colors flex items-center gap-2"
            >
              <span>Open Financial Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => openAuthModal('REGISTER')}
              className="px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition-colors"
            >
              Create Account with MFA
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Permissioned Ledger Auditing</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every financial transaction generates an immutable SHA-256 digest anchored into ledger blocks. Cryptographic Merkle proofs verify ledger integrity with zero personal data on-chain.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Explainable Anomaly Detection</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Statistical modified Z-score and median absolute deviation models detect spending irregularities, providing transparent attribution evidence for every alert.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Cryptographic Data Isolation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tenant-scoped private database queries, RFC 6238 TOTP hardware multi-factor authentication, PBKDF2 password hashing, and authenticated AES-256-GCM data exports.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
              System Architecture & Cryptographic Specifications
            </h3>
            <span className="text-[11px] text-emerald-600 font-mono font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Systems Operational
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] block">LEDGER ENGINE</span>
              <span className="text-slate-900 font-semibold text-xs block mt-1">Permissioned Ledger</span>
              <span className="text-slate-600 text-[10px]">SHA-256 Merkle Root</span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] block">AI & REASONING</span>
              <span className="text-slate-900 font-semibold text-xs block mt-1">Deterministic + LLM</span>
              <span className="text-indigo-600 text-[10px]">Grounded Inference</span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] block">AUTHENTICATION</span>
              <span className="text-slate-900 font-semibold text-xs block mt-1">PBKDF2 + TOTP</span>
              <span className="text-emerald-700 text-[10px]">Zero Cleartext PII</span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] block">PERSISTENCE</span>
              <span className="text-slate-900 font-semibold text-xs block mt-1">PostgreSQL / SQLite</span>
              <span className="text-slate-600 text-[10px]">Multi-Tenant IDOR Guard</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            CipherLedger AI • Secure Personal Finance Management System
          </p>
          <div className="flex items-center gap-4">
            <button onClick={onOpenTerms} className="text-slate-600 hover:text-slate-900 transition-colors">
              Terms of Service
            </button>
            <span className="text-slate-300">•</span>
            <button onClick={onOpenPrivacy} className="text-slate-600 hover:text-slate-900 transition-colors">
              Privacy Policy
            </button>
            <span className="text-slate-300">•</span>
            <button onClick={onEnterApp} className="text-slate-900 font-semibold hover:text-indigo-600 transition-colors">
              Launch App
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
