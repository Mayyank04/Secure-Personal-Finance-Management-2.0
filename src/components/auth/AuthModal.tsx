import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    login,
    completeMfa,
    register,
  } = useAuth();

  const isDevOrDemo = (import.meta as any).env?.DEV || (import.meta as any).env?.VITE_DEMO_MODE === 'true';
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>(authModalMode === 'login' && isDevOrDemo ? 'alex.morgan@fintech-demo.com' : '');
  const [password, setPassword] = useState<string>(authModalMode === 'login' && isDevOrDemo ? 'DemoPassword@2026' : '');

  const [currency, setCurrency] = useState<string>('INR');
  const [mfaCode, setMfaCode] = useState<string>('');
  const [mfaTicket, setMfaTicket] = useState<string>('');
  const [showMfaStep, setShowMfaStep] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const switchToSignup = () => {
    setAuthModalMode('signup');
    setShowMfaStep(false);
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
  };

  const switchToLogin = () => {
    setAuthModalMode('login');
    setShowMfaStep(false);
    setError(null);
  };


  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (authModalMode === 'login') {
        if (showMfaStep && mfaTicket) {
          if (!mfaCode || mfaCode.trim().length < 6) {
            setError('Please enter your 6-digit TOTP code or backup recovery key.');
            setIsLoading(false);
            return;
          }
          await completeMfa({ mfaTicket, code: mfaCode.trim() });
          setShowMfaStep(false);
          setMfaTicket('');
          setMfaCode('');
        } else {
          const res = await login({ email, password });
          if (res && res.mfaRequired && res.mfaTicket) {
            setMfaTicket(res.mfaTicket);
            setShowMfaStep(true);
            setIsLoading(false);
            return;
          }
        }
      } else if (authModalMode === 'signup') {
        await register({ name, email, password, currency });
      } else if (authModalMode === 'forgot') {
        const res = await api.forgotPassword(email);
        if (res.resetToken) {
          setResetToken(res.resetToken);
        }
        setResetSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {authModalMode === 'login'
                  ? showMfaStep
                    ? 'Two-Factor Authentication'
                    : 'Sign In to AegisFinance'
                  : authModalMode === 'signup'
                  ? 'Create Secure Account'
                  : 'Account Recovery'}
              </h3>
              <p className="text-xs text-slate-500">
                {authModalMode === 'login'
                  ? 'Access your private encrypted vault'
                  : authModalMode === 'signup'
                  ? 'Zero raw PII on blockchain ledger'
                  : 'Reset your encrypted authentication keys'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsAuthModalOpen(false);
              setShowMfaStep(false);
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resetSuccess ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Recovery Token Dispatched</span>
              </div>
              <p className="text-emerald-700">
                An encrypted password reset link has been dispatched to {email}. Follow the instructions to reset your vault credentials.
              </p>
              <button
                onClick={() => {
                  setAuthModalMode('login');
                  setResetSuccess(false);
                }}
                className="mt-2 text-xs text-indigo-600 font-semibold underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {authModalMode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Legal Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      placeholder="e.g. Sarah Jenkins"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              {!showMfaStep && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                        placeholder="name@example.com"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {authModalMode !== 'forgot' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-700">Vault Password</label>
                        {authModalMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => setAuthModalMode('forgot')}
                            className="text-[11px] text-indigo-600 font-medium hover:underline"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
                          placeholder="••••••••••••"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  )}

                  {authModalMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Primary Operating Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      >
                        <option value="INR">₹ Indian Rupee (INR)</option>
                        <option value="USD">$ US Dollar (USD)</option>
                        <option value="EUR">€ Euro (EUR)</option>
                        <option value="GBP">£ British Pound (GBP)</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {showMfaStep && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
                    <KeyRound className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      Enter the 6-digit verification code from your Authenticator app (TOTP) or use the prefilled demo code.
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">6-Digit Security Token</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      className="w-full text-center tracking-[0.5em] font-mono text-base font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-indigo-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>Authenticating Vault...</span>
                ) : (
                  <>
                    <span>
                      {authModalMode === 'login'
                        ? showMfaStep
                          ? 'Verify MFA & Enter'
                          : 'Sign In with Encrypted Session'
                        : authModalMode === 'signup'
                        ? 'Initialize Cryptographic Vault'
                        : 'Send Recovery Instructions'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Pre-filled Demo helper */}
          {authModalMode === 'login' && !showMfaStep && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <div>
                <span className="text-slate-900 font-medium">Demo Credentials:</span>
                <p className="font-mono text-slate-500">alex.morgan@fintech-demo.com</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('alex.morgan@fintech-demo.com');
                  setPassword('DemoPassword@2026');
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs text-indigo-600 text-[10px] font-mono font-semibold"
              >
                Auto-Fill
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-center text-xs text-slate-500">
          {authModalMode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={switchToSignup}
                className="text-indigo-600 font-semibold hover:underline"
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={switchToLogin}
                className="text-indigo-600 font-semibold hover:underline"
              >
                Sign in to your vault
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
