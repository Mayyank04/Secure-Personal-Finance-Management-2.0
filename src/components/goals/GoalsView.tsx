import React, { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  TrendingUp,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  DollarSign,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { SavingsGoal } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const GoalsView: React.FC = () => {
  const { currency } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState<string>('5000');
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState<string>('');
  const [newTarget, setNewTarget] = useState<string>('');
  const [newCurrent, setNewCurrent] = useState<string>('0');
  const [newDate, setNewDate] = useState<string>('2026-12-31');
  const [newMonthly, setNewMonthly] = useState<string>('10000');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [newCategory, setNewCategory] = useState<string>('Safety Net');

  const loadGoals = async () => {
    try {
      setIsLoading(true);
      const res = await api.getGoals();
      setGoals(res.goals);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, [currency]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newTarget) return;

    try {
      await api.createGoal({
        title: newTitle,
        targetAmount: Number(newTarget),
        currentAmount: Number(newCurrent) || 0,
        targetDate: newDate,
        monthlyContribution: Number(newMonthly) || 5000,
        priority: newPriority,
        category: newCategory,
      });
      setIsAddModalOpen(false);
      loadGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeGoal || !contributeAmount) return;

    try {
      await api.contributeToGoal(contributeGoal.id, Number(contributeAmount));
      setCelebrationMsg(`Added ${formatCurrency(Number(contributeAmount), currency)} to ${contributeGoal.title}!`);
      setTimeout(() => setCelebrationMsg(null), 4000);
      setContributeGoal(null);
      loadGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Capital Accumulation & Savings Goals</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated milestone projections, emergency reserves, and targeted liquidity
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Goal</span>
        </button>
      </div>

      {celebrationMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{celebrationMsg}</span>
          </div>
          <button onClick={() => setCelebrationMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-mono text-indigo-600 font-semibold uppercase tracking-wider">
            Total Goal Portfolio
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">
              {formatCurrency(totalSaved, currency)}
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              of {formatCurrency(totalTarget, currency)} target portfolio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Average Velocity</span>
            <span className="text-base font-bold text-indigo-600 font-mono">
              {formatCurrency(goals.reduce((s, g) => s + g.monthlyContribution, 0), currency)} / mo
            </span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center font-mono">
            <span className="text-base font-bold text-indigo-700">{overallPct}%</span>
            <span className="text-[8px] text-indigo-500 uppercase">Reached</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

          return (
            <div
              key={goal.id}
              className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {goal.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      goal.priority === 'HIGH'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {goal.priority} PRIORITY
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-3">{goal.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Target: {formatDate(goal.targetDate)}</p>

                <div className="flex items-baseline justify-between mt-4">
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {formatCurrency(goal.currentAmount, currency)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    of {formatCurrency(goal.targetAmount, currency)}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>{pct}% funded</span>
                    <span>Remaining: {formatCurrency(remaining, currency)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-slate-500 font-mono text-[11px]">
                  <span>{formatCurrency(goal.monthlyContribution, currency)} / mo</span>
                </div>

                <button
                  onClick={() => {
                    setContributeGoal(goal);
                    setContributeAmount('5000');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-medium text-xs border border-slate-200 transition-all flex items-center gap-1 group/btn"
                >
                  <Plus className="w-3 h-3 text-indigo-600 group-hover/btn:text-white" />
                  <span>Contribute</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {contributeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Contribute to Goal</h3>
                  <p className="text-xs text-slate-500">{contributeGoal.title}</p>
                </div>
              </div>
              <button onClick={() => setContributeGoal(null)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContribute} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Contribution Amount</label>
                <input
                  type="number"
                  required
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex gap-2">
                {['2000', '5000', '10000', '25000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setContributeAmount(amt)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700 border border-slate-200"
                  >
                    +{formatCurrency(Number(amt), currency)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setContributeGoal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs"
                >
                  Confirm Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Create Savings Goal</h3>
                  <p className="text-xs text-slate-500">Establish a targeted financial reserve</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Goal Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Down Payment Fund, New Laptop, Holiday Trip"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Amount</label>
                  <input
                    type="number"
                    required
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="100000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Starting Balance</label>
                  <input
                    type="number"
                    value={newCurrent}
                    onChange={(e) => setNewCurrent(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Monthly Contribution</label>
                  <input
                    type="number"
                    value={newMonthly}
                    onChange={(e) => setNewMonthly(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs"
                >
                  Save Savings Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
