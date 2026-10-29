import React, { useState, useEffect } from 'react';
import {
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit2,
  Sliders,
  Sparkles,
  TrendingUp,
  RefreshCw,
  X,
  Layers,
  ArrowRight,
  HelpCircle,
  Clock,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { Budget, TransactionCategory } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, CATEGORY_COLORS } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const BudgetsView: React.FC = () => {
  const { currency, openExplainModal } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const [totalBudgetInput, setTotalBudgetInput] = useState<number>(85000);
  const [rolloverEnabled, setRolloverEnabled] = useState<boolean>(true);
  const [normalThreshold, setNormalThreshold] = useState<number>(70);
  const [highThreshold, setHighThreshold] = useState<number>(90);
  const [categoryAllocations, setCategoryAllocations] = useState<{ category: TransactionCategory; allocatedAmount: number }[]>([
    { category: 'Rent', allocatedAmount: 25000 },
    { category: 'Food', allocatedAmount: 10000 },
    { category: 'Groceries', allocatedAmount: 8000 },
    { category: 'Shopping', allocatedAmount: 15000 },
    { category: 'Transport', allocatedAmount: 6000 },
    { category: 'Utilities', allocatedAmount: 5000 },
    { category: 'Subscriptions', allocatedAmount: 3500 },
    { category: 'Healthcare', allocatedAmount: 3000 },
    { category: 'Entertainment', allocatedAmount: 4500 },
    { category: 'Travel', allocatedAmount: 5000 },
  ]);

  const loadBudgetData = async () => {
    try {
      setIsLoading(true);
      const [bgtRes, dashRes] = await Promise.all([api.getBudgets(), api.getDashboard()]);
      setBudgets(bgtRes.budgets);
      setMonthlyComparison(dashRes.monthlyComparison || []);

      const map: Record<string, number> = {};
      (dashRes?.categoryDistribution || []).forEach((c) => {
        map[c.category] = c.amount;
      });
      setSpentByCategory(map);
      setTotalSpent(dashRes?.monthlyExpenses || 0);

      if (bgtRes?.budgets && bgtRes.budgets.length > 0) {
        const b = bgtRes.budgets[0];
        setTotalBudgetInput(b.totalBudget);
        setRolloverEnabled(b.rolloverEnabled);
        if (b.alertThresholds) {
          setNormalThreshold(b.alertThresholds.normal ?? 80);
          setHighThreshold(b.alertThresholds.high ?? 90);
        }
        setCategoryAllocations(b.categoryBudgets || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBudgetData();
  }, [currency]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (budgets.length > 0) {
        await api.updateBudget(budgets[0].id, {
          totalBudget: Number(totalBudgetInput),
          rolloverEnabled,
          alertThresholds: { normal: normalThreshold, high: highThreshold, exceeded: 100 },
          categoryBudgets: categoryAllocations,
        });
      } else {
        await api.createBudget({
          month: '2026-08',
          totalBudget: Number(totalBudgetInput),
          rolloverEnabled,
          alertThresholds: { normal: normalThreshold, high: highThreshold, exceeded: 100 },
          categoryBudgets: categoryAllocations,
        });
      }
      setIsEditModalOpen(false);
      loadBudgetData();
    } catch (err) {
      console.error(err);
    }
  };

  const currentBudget = budgets[0] || {
    totalBudget: 85000,
    categoryBudgets: categoryAllocations,
    alertThresholds: { normal: 70, high: 90, exceeded: 100 },
    rolloverEnabled: true,
  };

  const budgetRemaining = Math.max(0, currentBudget.totalBudget - totalSpent);
  const totalUtilization = currentBudget.totalBudget > 0 ? Math.round((totalSpent / currentBudget.totalBudget) * 100) : 0;

  const sumAllocated = currentBudget.categoryBudgets.reduce((sum, c) => sum + c.allocatedAmount, 0);
  const isAllocationOverBudget = sumAllocated > currentBudget.totalBudget;

  const currentDay = 28;
  const daysInMonth = 31;
  const daysRemaining = daysInMonth - currentDay;
  const dailyBurnRate = currentDay > 0 ? Math.round(totalSpent / currentDay) : 0;
  const projectedMonthEndTotal = Math.round(totalSpent + dailyBurnRate * daysRemaining);
  const projectedVariance = projectedMonthEndTotal - currentBudget.totalBudget;

  const getCategoryStatusBadge = (ratio: number, isOver: boolean) => {
    if (isOver || ratio >= 100) {
      return { label: 'Exceeded', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertTriangle };
    }
    if (ratio >= currentBudget.alertThresholds.high) {
      return { label: 'Near Limit', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle };
    }
    if (ratio >= currentBudget.alertThresholds.normal) {
      return { label: 'Watch', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: Clock };
    }
    return { label: 'On Track', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 };
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Monthly Budget Planning & Controls</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time threshold monitoring with early risk alerts and category discipline
          </p>
        </div>

        <button
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all self-start"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Configure Budget Limits</span>
        </button>
      </div>

      {isAllocationOverBudget && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">Category Allocation Advisory:</span>
            <p className="text-amber-800 leading-relaxed">
              Sum of category targets ({formatCurrency(sumAllocated, currency)}) exceeds your overall monthly budget cap ({formatCurrency(currentBudget.totalBudget, currency)}) by{' '}
              <strong className="font-semibold">{formatCurrency(sumAllocated - currentBudget.totalBudget, currency)}</strong>. Consider adjusting category caps or increasing the monthly ceiling.
            </p>
          </div>
        </div>
      )}

      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-indigo-600 font-semibold uppercase tracking-wider">
                August 2026 Monthly Cap
              </span>
              {currentBudget.rolloverEnabled && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-200">
                  Rollover Active (+₹4,200 from July)
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <h2 className="text-2xl font-bold text-slate-900 font-mono">
                {formatCurrency(totalSpent, currency)}
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                of {formatCurrency(currentBudget.totalBudget, currency)} allocated
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-500">Available Cushion</span>
            <h3 className="text-lg font-bold text-emerald-600 font-mono">
              {formatCurrency(budgetRemaining, currency)}
            </h3>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalUtilization > currentBudget.alertThresholds.high
                  ? 'bg-rose-500'
                  : totalUtilization > currentBudget.alertThresholds.normal
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, totalUtilization)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
            <span>0%</span>
            <span className="text-slate-500">Caution: {currentBudget.alertThresholds.normal}%</span>
            <span className="text-amber-600 font-semibold">Critical: {currentBudget.alertThresholds.high}%</span>
            <span className="text-rose-600 font-bold">100% Limit</span>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AI Month-End Spending Projection</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculated at Day {currentDay} of {daysInMonth} ({daysRemaining} days remaining in billing cycle)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Daily Burn Rate</span>
              <span className="text-slate-900 font-bold">{formatCurrency(dailyBurnRate, currency)}/day</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Est. Month-End Total</span>
              <span className="text-indigo-600 font-bold">{formatCurrency(projectedMonthEndTotal, currency)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Projected Status</span>
              <span className={projectedVariance > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                {projectedVariance > 0 ? `+${formatCurrency(projectedVariance, currency)} Over` : 'Within Budget'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentBudget.categoryBudgets.map((cb) => {
          const spent = spentByCategory[cb.category] || 0;
          const ratio = cb.allocatedAmount > 0 ? Math.round((spent / cb.allocatedAmount) * 100) : 0;
          const isOver = spent > cb.allocatedAmount;
          const colors = CATEGORY_COLORS[cb.category] || CATEGORY_COLORS.Other;
          const statusBadge = getCategoryStatusBadge(ratio, isOver);
          const StatusIcon = statusBadge.icon;

          return (
            <div
              key={cb.category}
              className={`p-5 rounded-3xl bg-white border transition-all flex flex-col justify-between shadow-xs ${
                isOver
                  ? 'border-rose-300 bg-rose-50/20'
                  : ratio >= currentBudget.alertThresholds.high
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                    {cb.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border flex items-center gap-1 ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusBadge.label} ({ratio}%)
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-4">
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {formatCurrency(spent, currency)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Cap: {formatCurrency(cb.allocatedAmount, currency)}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOver ? 'bg-rose-500' : ratio >= currentBudget.alertThresholds.normal ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, ratio)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Remaining Cushion:</span>
                  <span className={isOver ? 'text-rose-600 font-semibold' : 'text-slate-700'}>
                    {isOver ? `-${formatCurrency(spent - cb.allocatedAmount, currency)}` : formatCurrency(cb.allocatedAmount - spent, currency)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Historical Budget Adherence (6-Month Trajectory)</h3>
            <p className="text-xs text-slate-500">Track monthly expense discipline vs ₹85,000 baseline cap</p>
          </div>
          <span className="text-xs font-mono text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            5 of 6 Months On Track
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-2">Month</th>
                <th className="pb-2 text-right">Income</th>
                <th className="pb-2 text-right">Expenses</th>
                <th className="pb-2 text-right">Budget Limit</th>
                <th className="pb-2 text-right">Net Savings</th>
                <th className="pb-2 text-center">Adherence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {monthlyComparison.map((m) => {
                const adherence = m.expenses <= 85000;
                return (
                  <tr key={m.month} className="hover:bg-slate-50">
                    <td className="py-2.5 font-sans font-medium text-slate-800">{m.month}</td>
                    <td className="py-2.5 text-right text-emerald-700 font-bold">{formatCurrency(m.income, currency)}</td>
                    <td className="py-2.5 text-right text-slate-900 font-bold">{formatCurrency(m.expenses, currency)}</td>
                    <td className="py-2.5 text-right text-slate-500">{formatCurrency(85000, currency)}</td>
                    <td className="py-2.5 text-right text-indigo-600 font-bold">{formatCurrency(m.savings, currency)}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          adherence
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {adherence ? 'Adhered' : 'Exceeded'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Configure Monthly Budget Caps</h3>
                  <p className="text-xs text-slate-500">Set total and category targets for August 2026</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Total Monthly Budget Limit</label>
                <input
                  type="number"
                  required
                  value={totalBudgetInput}
                  onChange={(e) => setTotalBudgetInput(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Normal Warning (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="80"
                    value={normalThreshold}
                    onChange={(e) => setNormalThreshold(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Critical Warning (%)</label>
                  <input
                    type="number"
                    min="80"
                    max="99"
                    value={highThreshold}
                    onChange={(e) => setHighThreshold(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rollCheck"
                  checked={rolloverEnabled}
                  onChange={(e) => setRolloverEnabled(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="rollCheck" className="text-xs text-slate-700 cursor-pointer">
                  Enable Budget Rollover (carry over unspent cushion to next month)
                </label>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Category Allocations
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {categoryAllocations.map((ca, idx) => (
                    <div key={ca.category} className="flex items-center justify-between gap-3 text-xs">
                      <span className="w-28 text-slate-700 truncate">{ca.category}</span>
                      <input
                        type="number"
                        value={ca.allocatedAmount}
                        onChange={(e) => {
                          const updated = [...categoryAllocations];
                          updated[idx].allocatedAmount = Number(e.target.value);
                          setCategoryAllocations(updated);
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs"
                >
                  Save Budget Caps
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
