import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Flame,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Subscription, SubscriptionStatus, SubscriptionFrequency, FinancialAccount } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const SubscriptionsView: React.FC = () => {
  const { currency } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [summary, setSummary] = useState({
    totalSubscriptions: 0,
    activeCount: 0,
    pausedCount: 0,
    cancelledCount: 0,
    totalMonthlyBurn: 0,
    totalAnnualBurn: 0,
    duplicateFlags: [] as string[],
    priceChangeAlertsCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    merchant: '',
    amount: '',
    frequency: 'MONTHLY' as SubscriptionFrequency,
    nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    accountId: '',
    notes: '',
  });

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const res = await api.getSubscriptions();
      setSubscriptions(res.subscriptions || []);
      setSummary(
        res.summary || {
          totalSubscriptions: 0,
          activeCount: 0,
          pausedCount: 0,
          cancelledCount: 0,
          totalMonthlyBurn: 0,
          totalAnnualBurn: 0,
          duplicateFlags: [],
          priceChangeAlertsCount: 0,
        }
      );

      const accRes = await api.getAccounts();
      setAccounts(accRes.accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingSub(null);
    setFormState({
      name: '',
      merchant: '',
      amount: '',
      frequency: 'MONTHLY',
      nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      accountId: accounts[0]?.id || '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    setFormState({
      name: sub.name,
      merchant: sub.merchant,
      amount: sub.amount.toString(),
      frequency: sub.frequency,
      nextBillingDate: sub.nextBillingDate,
      accountId: sub.accountId || '',
      notes: sub.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSub) {
        await api.updateSubscription(editingSub.id, {
          name: formState.name,
          merchant: formState.merchant,
          amount: Number(formState.amount),
          frequency: formState.frequency,
          nextBillingDate: formState.nextBillingDate,
          accountId: formState.accountId || undefined,
          notes: formState.notes,
        });
      } else {
        await api.createSubscription({
          name: formState.name,
          merchant: formState.merchant || formState.name,
          amount: Number(formState.amount),
          frequency: formState.frequency,
          nextBillingDate: formState.nextBillingDate,
          accountId: formState.accountId || undefined,
          notes: formState.notes,
        });
      }
      setIsModalOpen(false);
      fetchSubscriptions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (id: string, status: SubscriptionStatus) => {
    try {
      await api.updateSubscriptionStatus(id, status);
      fetchSubscriptions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteSubscription = async (id: string, name: string) => {
    if (!window.confirm(`Delete subscription "${name}"?`)) return;
    try {
      await api.deleteSubscription(id);
      fetchSubscriptions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredSubs = subscriptions.filter(s => {
    if (filterStatus === 'ALL') return true;
    return s.status === filterStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Flame className="w-7 h-7 text-rose-500" />
            Subscriptions & Recurring Burn
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track streaming services, cloud software, gym memberships, price increases, and annual burn rates.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Subscription
        </button>
      </div>

      {/* Burn Analytics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Monthly Recurring Burn</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            ₹{summary.totalMonthlyBurn.toLocaleString('en-IN')}/mo
          </p>
          <p className="text-xs text-slate-400 mt-1">Direct monthly outflow</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Annual Run-Rate Cost</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{summary.totalAnnualBurn.toLocaleString('en-IN')}/yr
          </p>
          <p className="text-xs text-slate-400 mt-1">Projected 12-month commitment</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Active Subscriptions</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{summary.activeCount}</p>
          <p className="text-xs text-slate-400 mt-1">
            {summary.pausedCount} paused, {summary.cancelledCount} cancelled
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>AI Price Watch Alerts</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{summary.priceChangeAlertsCount}</p>
          <p className="text-xs text-amber-600 mt-1">Price change detected</p>
        </div>
      </div>

      {/* Duplicate & Waste Detection Banners */}
      {summary.duplicateFlags.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            AI Subscription Optimization Notice:
          </div>
          {summary.duplicateFlags.map((flag, i) => (
            <p key={i} className="pl-6 text-amber-800">
              • {flag} Consider auditing redundant plans to reduce annual burn by up to ₹5,000.
            </p>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Subscriptions' },
          { id: 'ACTIVE', label: 'Active Plans' },
          { id: 'PAUSED', label: 'Paused' },
          { id: 'CANCELLED', label: 'Cancelled' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              filterStatus === f.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Subscriptions Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-sm font-medium">Analyzing recurring subscriptions...</p>
        </div>
      ) : filteredSubs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Flame className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No subscriptions found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Add recurring subscriptions like Spotify, Netflix, AWS, or gym memberships to audit your monthly burn.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Subscription
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubs.map(sub => {
            const isActive = sub.status === 'ACTIVE';
            const isPaused = sub.status === 'PAUSED';

            return (
              <div
                key={sub.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 text-sm">{sub.name}</h4>
                        {sub.priceChangeDetected && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            PRICE INCREASE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {sub.merchant} • {sub.frequency.toLowerCase()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(sub)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubscription(sub.id, sub.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Cost Details */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Recurring Cost</div>
                      <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                        ₹{sub.amount.toLocaleString('en-IN')}
                        <span className="text-xs text-slate-400 font-normal">/{sub.frequency.toLowerCase().slice(0, 2)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-medium">Annual Equivalent</div>
                      <div className="text-xs font-bold font-mono text-indigo-700 mt-0.5">
                        ₹{sub.annualCost.toLocaleString('en-IN')}/yr
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Next billing: <strong className="text-slate-700 font-mono">{sub.nextBillingDate}</strong>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isPaused
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>

                  {sub.notes && (
                    <p className="mt-2 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                      "{sub.notes}"
                    </p>
                  )}
                </div>

                {/* Status Toggle Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <button
                        onClick={() => handleStatusChange(sub.id, 'PAUSED')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                      >
                        <Pause className="w-3 h-3" />
                        Pause Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(sub.id, 'ACTIVE')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                      >
                        <Play className="w-3 h-3" />
                        Resume Plan
                      </button>
                    )}

                    {sub.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleStatusChange(sub.id, 'CANCELLED')}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                        title="Mark Cancelled"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {sub.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingSub ? 'Edit Subscription' : 'Add New Subscription'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service / Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix Premium, Spotify Family, GitHub Pro"
                  value={formState.name}
                  onChange={e => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Merchant / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Netflix Inc, Apple Services"
                    value={formState.merchant}
                    onChange={e => setFormState({ ...formState, merchant: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formState.amount}
                    onChange={e => setFormState({ ...formState, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Cadence</label>
                  <select
                    value={formState.frequency}
                    onChange={e =>
                      setFormState({
                        ...formState,
                        frequency: e.target.value as SubscriptionFrequency,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Next Billing Date</label>
                  <input
                    type="date"
                    required
                    value={formState.nextBillingDate}
                    onChange={e => setFormState({ ...formState, nextBillingDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method / Account</label>
                <select
                  value={formState.accountId}
                  onChange={e => setFormState({ ...formState, accountId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">None (Select later)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.institution})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Plan Tier</label>
                <input
                  type="text"
                  placeholder="e.g. 4 screens 4K plan, billed on Amex"
                  value={formState.notes}
                  onChange={e => setFormState({ ...formState, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                >
                  {editingSub ? 'Save Changes' : 'Register Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
