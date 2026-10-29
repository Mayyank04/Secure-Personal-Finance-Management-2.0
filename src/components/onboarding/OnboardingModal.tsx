import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  BrainCircuit,
  Database,
  Layers,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Sparkles,
  Sliders,
  Check,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export const OnboardingModal: React.FC = () => {
  const { isOnboardingOpen, setIsOnboardingOpen, setCurrency, refreshProfile } = useAuth();
  const [step, setStep] = useState<number>(1);

  const [selectedCurrency, setSelectedCurrency] = useState<'INR' | 'USD' | 'EUR' | 'GBP'>('INR');
  const [incomeRange, setIncomeRange] = useState<string>('₹80,000 - ₹120,000');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Food',
    'Groceries',
    'Rent',
    'Transport',
    'Subscriptions',
    'Utilities',
  ]);
  const [normalWarning, setNormalWarning] = useState<number>(70);
  const [highWarning, setHighWarning] = useState<number>(90);
  const [aiConsent, setAiConsent] = useState<boolean>(true);
  const [blockchainConsent, setBlockchainConsent] = useState<boolean>(true);
  const [dataSharingConsent, setDataSharingConsent] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOnboardingOpen) return null;

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
      }
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleFinish = async () => {
    try {
      setIsSaving(true);
      await api.saveOnboarding({
        preferredCurrency: selectedCurrency,
        monthlyIncomeRange: incomeRange,
        majorCategories: selectedCategories,
        budgetThresholds: {
          normalWarning,
          highWarning,
          critical: 100,
        },
        privacySettings: {
          aiPersonalizationConsent: aiConsent,
          dataSharingConsent,
          analyticsPermission: true,
          blockchainAuditConsent: blockchainConsent,
        },
      });
      setCurrency(selectedCurrency);
      await refreshProfile();
      setIsOnboardingOpen(false);
    } catch {
      setIsOnboardingOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const allCategoryOptions = [
    'Food',
    'Groceries',
    'Transport',
    'Shopping',
    'Entertainment',
    'Bills',
    'Utilities',
    'Healthcare',
    'Education',
    'Travel',
    'Subscriptions',
    'Rent',
    'Investment',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="w-full bg-slate-100 h-1.5 flex">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div
              key={s}
              className={`flex-1 transition-all duration-300 ${
                s <= step ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Setup Your Financial Vault</h3>
              <p className="text-xs text-slate-500">Step {step} of 7 • Personalization & Privacy Guard</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">{Math.round((step / 7) * 100)}% Complete</span>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                <span className="text-[10px] font-mono font-semibold uppercase text-indigo-700">
                  Zero Trust Architecture
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-1">
                  How AegisFinance Protects Your Money & Privacy
                </h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Unlike traditional finance apps that sell transaction telemetry or expose raw bank feeds, AegisFinance uses a strict tripartite architecture:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <h5 className="text-xs font-semibold text-slate-900">1. Private Encrypted DB</h5>
                  <p className="text-[11px] text-slate-600">
                    Amounts, merchants, and descriptions are stored in tenant-isolated, AES-256 hardware-encrypted vaults.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-600" />
                  <h5 className="text-xs font-semibold text-slate-900">2. Explainable AI (XAI)</h5>
                  <p className="text-[11px] text-slate-600">
                    Local machine learning models categorize spending and detect statistical outliers with clear reasoning.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h5 className="text-xs font-semibold text-slate-900">3. Hyperledger Audit</h5>
                  <p className="text-[11px] text-slate-600">
                    Only immutable SHA-256 hashes are anchored to the blockchain for tamper-evident proof. Zero PII on-chain.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Select Your Operating Currency</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Choose your primary currency for balance tracking, forecasts, and budget thresholds.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
                  { code: 'USD', symbol: '$', label: 'US Dollar' },
                  { code: 'EUR', symbol: '€', label: 'Euro' },
                  { code: 'GBP', symbol: '£', label: 'British Pound' },
                ].map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => setSelectedCurrency(curr.code as any)}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      selectedCurrency === curr.code
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl font-bold block mb-1">{curr.symbol}</span>
                    <span className="text-xs font-semibold block">{curr.code}</span>
                    <span className="text-[10px] text-slate-500">{curr.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Estimated Monthly Inflow</h4>
                <p className="text-xs text-slate-500 mt-1">
                  This baseline helps calibrate your savings rate targets and financial health score.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Under ₹50,000 / mo',
                  '₹50,000 - ₹80,000 / mo',
                  '₹80,000 - ₹120,000 / mo',
                  '₹120,000 - ₹200,000 / mo',
                  '₹200,000+ / mo',
                ].map((range) => (
                  <button
                    key={range}
                    onClick={() => setIncomeRange(range)}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      incomeRange === range
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-600 font-semibold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-medium">{range}</span>
                    {incomeRange === range && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Primary Expense Categories</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Select the categories relevant to your monthly lifestyle for AI categorization and budgeting.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {allCategoryOptions.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-2xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Budget Warning Thresholds</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Define automated warning stages when monthly spending approaches your limit.
                </p>
              </div>

              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Normal Alert Threshold: {normalWarning}%</span>
                    <span className="text-slate-500">Early Caution</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="80"
                    value={normalWarning}
                    onChange={(e) => setNormalWarning(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Critical Alert Threshold: {highWarning}%</span>
                    <span className="text-amber-600 font-semibold">High Alert</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="98"
                    value={highWarning}
                    onChange={(e) => setHighWarning(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Privacy & Cryptographic Consent</h4>
                <p className="text-xs text-slate-500 mt-1">
                  We explain our privacy model upfront before requesting your explicit authorization.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-900">AI Personalization & Outlier Detection</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Allows on-device & server-side ML algorithms to analyze your transactions for anomalies, forecasts, and recurring bills.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-900">Hyperledger Blockchain Audit Trail</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Anchors one-way SHA-256 mathematical hashes to the permissioned audit ledger. No personal transaction strings are placed on-chain.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={blockchainConsent}
                    onChange={(e) => setBlockchainConsent(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4 opacity-75">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-900">Third-Party Data Sharing (Strictly Disabled)</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      We never sell or monetize financial telemetry to advertising networks.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    disabled
                    checked={dataSharingConsent}
                    className="mt-1 w-4 h-4 accent-indigo-600 rounded cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4 text-center py-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900">Your Secure Financial Vault is Ready!</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Your tenant-isolated environment is initialized with full AI intelligence, tamper-evident Hyperledger audit trails, and privacy guards.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex items-center gap-2 text-indigo-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>3-Month Verified Synthetic Baseline Loaded</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>2 Anomaly Scenarios Ready for Review</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>39 Immutable Blockchain Blocks Anchored</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 7 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-2 shadow-xs"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <span>{isSaving ? 'Configuring Vault...' : 'Enter AegisFinance'}</span>
              <Zap className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
