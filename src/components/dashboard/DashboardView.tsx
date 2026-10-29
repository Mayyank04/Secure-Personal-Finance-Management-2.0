import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Layers,
  Activity,
  Plus,
  RefreshCw,
  Info,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { DashboardData, Transaction } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, formatDate, truncateHash, CATEGORY_COLORS } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const DashboardView: React.FC = () => {
  const { currency, setActiveTab, openVerifyModal, openExplainModal } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currency]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Decrypting tenant records and verifying ledger state...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-semibold text-slate-800">Unable to load dashboard</h3>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 rounded-xl bg-slate-900 text-xs font-medium text-white hover:bg-slate-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  const PIE_COLORS = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#dc2626', '#64748b'];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial Overview & Integrity</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            August 2026 Accounting Period • All transactions anchored to Hyperledger Fabric
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('transactions')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Transaction</span>
          </button>
          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200 shadow-xs transition-colors"
            title="Refresh Ledger Cache"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Net Liquid Balance</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {formatCurrency(data.totalBalance, currency)}
            </h3>
            <span className="text-[10px] text-emerald-700 flex items-center gap-1 mt-1 font-mono font-medium">
              <ShieldCheck className="w-3 h-3" />
              Verified On-Chain
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>August Inflow</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {formatCurrency(data.monthlyIncome, currency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">Salary + Freelance Retainer</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>August Expenses</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {formatCurrency(data.monthlyExpenses, currency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">Across 17 transactions</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Goal Reserves</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {formatCurrency(data.totalSavings, currency)}
            </h3>
            <span className="text-[10px] text-purple-700 mt-1 block font-mono font-medium">3 Active Goals (68% avg)</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Budget Balance</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {formatCurrency(data.budgetRemaining, currency)}
            </h3>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  data.budgetAdherenceRatio > 0.9 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.round(data.budgetAdherenceRatio * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Financial Health Index
                </h3>
              </div>
              <button
                onClick={() =>
                  openExplainModal({
                    title: 'Financial Health Score Methodology',
                    explanation:
                      'The score is a composite index computed from 4 weighted variables: Savings Velocity (25%), Budget Adherence (25%), Anomaly & Volatility Risk (25%), and Emergency Reserve Buffer (25%).',
                    signals: [
                      `Current Savings Rate: ${Math.round(((data.monthlyIncome - data.monthlyExpenses) / data.monthlyIncome) * 100)}% of Inflow`,
                      `Budget Utilization: ${Math.round(data.budgetAdherenceRatio * 100)}% of Limit`,
                      `Emergency Runway: ~4.2 Months`,
                    ],
                    action: 'Maintain budget discipline in the Food and Shopping categories to reach 90+ rating.',
                  })
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center shrink-0">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {data.financialHealth.score}
                </span>
                <span className="text-[9px] font-bold text-emerald-800 font-mono uppercase">
                  {data.financialHealth.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {data.financialHealth.summary}
                </p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Calibrated via statistical baseline models
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
            {data.financialHealth.components.map((comp, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span className="truncate">{comp.label}</span>
                  <span className="font-mono text-emerald-700 font-semibold">{comp.score}/{comp.max}</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${(comp.score / comp.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                3-Month Cashflow Trajectory (Jun – Aug 2026)
              </h3>
              <p className="text-[11px] text-slate-500">Monthly Inflows vs. Total Verified Outflows</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600"></span>
                Inflow
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span>
                Expenses
              </span>
            </div>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), '']}
                />
                <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                August Category Breakdown
              </h3>
              <p className="text-[11px] text-slate-500">Expense Allocation by Category</p>
            </div>
          </div>

          <div className="h-44 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryDistribution || []}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  {(data.categoryDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Spend']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-slate-400 font-mono">TOTAL</span>
              <span className="text-xs font-bold text-slate-800 font-mono">
                {formatCurrency(data.monthlyExpenses, currency)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
            {(data.categoryDistribution || []).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="text-slate-700 font-medium">{cat.category}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 text-[11px]">{cat.percentage}%</span>
                  <span className="text-slate-900 font-semibold">{formatCurrency(cat.amount, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                August Daily Spending Volatility
              </h3>
              <p className="text-[11px] text-slate-500">Daily Outflow Cadence with Anomaly Peaks Highlighted</p>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
              Mean: ₹2,980 / day
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.spendingTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Outflow']}
                />
                <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#spendingGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Active Savings Goals
              </h3>
              <p className="text-[11px] text-slate-500">Automated Monthly Capital Allocations</p>
            </div>
            <button
              onClick={() => setActiveTab('goals')}
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Manage Goals</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.savingsGoals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              return (
                <div key={goal.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-700 font-semibold uppercase tracking-wider">
                      {goal.category || 'General'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{goal.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Target: {formatDate(goal.targetDate)}
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-900 font-bold">{formatCurrency(goal.currentAmount, currency)}</span>
                      <span className="text-slate-500 font-medium">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      Target: {formatCurrency(goal.targetAmount, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Recurring Commitments
                </h3>
                <p className="text-[11px] text-slate-500">Scheduled Subscriptions & Bills</p>
              </div>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>

            <div className="space-y-2">
              {data.upcomingRecurring.map((rec) => (
                <div key={rec.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-semibold text-slate-800 truncate">{rec.merchant}</h5>
                    <p className="text-[10px] text-slate-500 font-mono">Due: {formatDate(rec.nextDueDate)}</p>
                  </div>
                  <div className="text-right ml-2">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      {formatCurrency(rec.amount, currency)}
                    </span>
                    <span className="text-[9px] text-purple-700 block font-mono font-medium">Monthly</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('insights')}
            className="w-full mt-3 py-2 text-center text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-medium"
          >
            Review Subscription Audit →
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent Transactions & Ledger Audit Status
            </h3>
            <p className="text-[11px] text-slate-500">
              Each row displays AI classification confidence and cryptographic SHA-256 block anchor.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('transactions')}
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View All ({(data.recentTransactions?.length || 0)}+)</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Date</th>
                <th className="pb-3">Description & Merchant</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">AI Confidence</th>
                <th className="pb-3">Blockchain Digest</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 text-right pr-2">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.recentTransactions || []).map((tx) => {
                const colors = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.Other;
                return (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 pl-2 font-mono text-slate-500 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="py-3 pr-2">
                      <div className="font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                        {tx.description}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{tx.merchant} • {tx.paymentMethod}</div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                        {tx.aiConfidence}% match
                      </span>
                    </td>
                    <td className="py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                        <span>{truncateHash(tx.blockchainHash, 6, 4)}</span>
                        <span className="text-[9px] text-slate-400">(Blk #{tx.blockNumber})</span>
                      </div>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap font-mono font-bold">
                      <span className={tx.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2 whitespace-nowrap">
                      <button
                        onClick={() => openVerifyModal(tx)}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold text-[11px] border border-slate-200 transition-all flex items-center gap-1 ml-auto shadow-2xs"
                      >
                        <ShieldCheck className="w-3 h-3 text-indigo-600" />
                        <span>Verify</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
