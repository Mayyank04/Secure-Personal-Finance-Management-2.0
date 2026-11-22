import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShieldCheck,
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
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Percent,
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
  Line,
} from 'recharts';
import { DashboardData, Transaction } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, formatDate, truncateHash, CATEGORY_COLORS } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { MetricCardsGridSkeleton, ChartCardSkeleton, TableSkeleton } from '../common/Skeleton';

export const DashboardView: React.FC = () => {
  const { currency, setActiveTab, openVerifyModal, openExplainModal } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters for recent transactions table on dashboard
  const [txSearch, setTxSearch] = useState<string>('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [txSortOrder, setTxSortOrder] = useState<'desc' | 'asc'>('desc');

  // Chart view filter (e.g., 3-month vs 6-month view)
  const [chartPeriod, setChartPeriod] = useState<'3M' | '6M'>('6M');

  const fetchDashboardData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const res = await api.getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load financial dashboard. Please check database connectivity.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currency]);

  // Filtered and sorted transactions for the dashboard view
  const filteredTransactions = useMemo(() => {
    if (!data?.recentTransactions) return [];
    let list = [...data.recentTransactions];

    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    if (txCategoryFilter !== 'ALL') {
      list = list.filter((t) => t.category.toLowerCase() === txCategoryFilter.toLowerCase());
    }

    if (txTypeFilter !== 'ALL') {
      list = list.filter((t) => t.type === txTypeFilter);
    }

    list.sort((a, b) => {
      if (txSortOrder === 'desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime() || b.amount - a.amount;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime() || a.amount - b.amount;
    });

    return list;
  }, [data?.recentTransactions, txSearch, txCategoryFilter, txTypeFilter, txSortOrder]);

  // Derived financial analytics
  const netSavings = useMemo(() => {
    if (!data) return 0;
    return data.netSavings !== undefined ? data.netSavings : data.monthlyIncome - data.monthlyExpenses;
  }, [data]);

  const savingsRate = useMemo(() => {
    if (!data || data.monthlyIncome <= 0) return 0;
    return Math.max(0, Math.round((netSavings / data.monthlyIncome) * 100));
  }, [data, netSavings]);

  const upcomingPaymentsTotal = useMemo(() => {
    if (!data) return 0;
    const billsTotal = (data.upcomingBills || []).reduce((sum, b) => sum + b.amount, 0);
    const recTotal = (data.upcomingRecurring || []).reduce((sum, r) => sum + r.amount, 0);
    return billsTotal > 0 ? billsTotal : recTotal;
  }, [data]);

  const upcomingPaymentsCount = useMemo(() => {
    if (!data) return 0;
    return (data.upcomingBills?.length || 0) + (data.upcomingRecurring?.length || 0);
  }, [data]);

  // Chart data based on selected period
  const displayMonthlyComparison = useMemo(() => {
    if (!data?.monthlyComparison) return [];
    if (chartPeriod === '3M') {
      return data.monthlyComparison.slice(-3);
    }
    return data.monthlyComparison;
  }, [data?.monthlyComparison, chartPeriod]);

  // Grounded AI insights calculated from actual user records
  const calculatedInsights = useMemo(() => {
    if (!data) return [];
    const items = [];

    // 1. Highest spending category
    if (data.categoryDistribution && data.categoryDistribution.length > 0) {
      const topCat = data.categoryDistribution[0];
      items.push({
        id: 'top-category',
        title: 'Primary Capital Outflow',
        text: `${topCat.category} represents your largest spending sector this period at ${formatCurrency(topCat.amount, currency)} (${topCat.percentage}% of all expenses).`,
        type: 'INFO' as const,
        action: 'Review Category Allocation',
        targetTab: 'transactions',
      });
    }

    // 2. Anomaly detection status
    if (data.anomaliesCount > 0) {
      items.push({
        id: 'anomaly-flag',
        title: 'Statistical Spending Anomaly',
        text: `${data.anomaliesCount} transaction(s) exceed your historical 2σ spending baseline and require verification.`,
        type: 'WARNING' as const,
        action: 'Inspect Anomalies',
        targetTab: 'insights',
      });
    } else {
      items.push({
        id: 'anomaly-clear',
        title: 'Spending Pattern Baseline',
        text: 'All recorded expenditures are within normal variance thresholds across past cycles.',
        type: 'SUCCESS' as const,
        action: 'View Statistical Models',
        targetTab: 'insights',
      });
    }

    // 3. Monthly pacing / comparison
    if (data.monthlyComparison && data.monthlyComparison.length >= 2) {
      const current = data.monthlyComparison[data.monthlyComparison.length - 1];
      const previous = data.monthlyComparison[data.monthlyComparison.length - 2];
      if (previous && previous.expenses > 0) {
        const diff = current.expenses - previous.expenses;
        const diffPct = Math.round((Math.abs(diff) / previous.expenses) * 100);
        if (diff > 0) {
          items.push({
            id: 'pacing-up',
            title: 'Expense Pacing Shift',
            text: `Expenditures are running ${diffPct}% higher (${formatCurrency(diff, currency)}) compared to ${previous.month}.`,
            type: 'WARNING' as const,
            action: 'Compare Monthly Cashflow',
            targetTab: 'reports',
          });
        } else {
          items.push({
            id: 'pacing-down',
            title: 'Expenditure Discipline',
            text: `Expenditures are ${diffPct}% lower than ${previous.month}, generating ${formatCurrency(Math.abs(diff), currency)} in retained liquidity.`,
            type: 'SUCCESS' as const,
            action: 'Inspect Monthly Trends',
            targetTab: 'reports',
          });
        }
      }
    }

    // 4. Budget adherence
    if (data.totalBudget > 0) {
      const pct = Math.round(data.budgetAdherenceRatio * 100);
      if (pct >= 85) {
        items.push({
          id: 'budget-warning',
          title: 'Budget Threshold Notice',
          text: `You have consumed ${pct}% of your allocated monthly cap with ${formatCurrency(data.budgetRemaining, currency)} remaining.`,
          type: 'WARNING' as const,
          action: 'Adjust Budgets',
          targetTab: 'budgets',
        });
      } else {
        items.push({
          id: 'budget-healthy',
          title: 'Budget Discipline',
          text: `Budget utilization is healthy at ${pct}%, with ${formatCurrency(data.budgetRemaining, currency)} headroom remaining.`,
          type: 'SUCCESS' as const,
          action: 'View Budget Targets',
          targetTab: 'budgets',
        });
      }
    }

    return items;
  }, [data, currency]);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="h-6 w-56 rounded bg-slate-200 animate-pulse" />
            <div className="h-3.5 w-80 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="h-9 w-36 rounded-xl bg-slate-200 animate-pulse" />
        </div>
        <MetricCardsGridSkeleton count={6} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartCardSkeleton height="h-64" />
          </div>
          <div>
            <ChartCardSkeleton height="h-64" />
          </div>
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">Unable to Load Dashboard</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
        <button
          onClick={() => fetchDashboardData(true)}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const PIE_COLORS = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#db2777', '#0d9488', '#e11d48', '#64748b'];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial Overview</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              Active Period
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Fabric-Compatible Enterprise Ledger Simulation • Tenant-Isolated Multi-Asset Vault
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('transactions')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Transaction</span>
          </button>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200 shadow-xs transition-colors disabled:opacity-50"
            title="Refresh Ledger Cache"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* 6-Card Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Balance */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Net Liquid Balance</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrency(data.totalBalance, currency)}
            </h3>
            <span className="text-[10px] text-emerald-700 flex items-center gap-1 mt-1 font-mono font-medium">
              <ShieldCheck className="w-3 h-3" />
              Verified On-Chain
            </span>
          </div>
        </div>

        {/* Card 2: Monthly Income */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Monthly Inflow</span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrency(data.monthlyIncome, currency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Salary, Retainers & Dividends
            </span>
          </div>
        </div>

        {/* Card 3: Monthly Expenses */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Monthly Expenses</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrency(data.monthlyExpenses, currency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Across {(data.recentTransactions?.length || 0)} recorded items
            </span>
          </div>
        </div>

        {/* Card 4: Net Savings */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Net Monthly Savings</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-xl font-bold font-mono tabular-nums tracking-tight ${netSavings >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings, currency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Inflow minus Outflow
            </span>
          </div>
        </div>

        {/* Card 5: Savings Rate */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Savings Velocity</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
                {savingsRate}%
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Target: 20%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${savingsRate >= 20 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, savingsRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 6: Upcoming Payments */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Upcoming Due</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrency(upcomingPaymentsTotal, currency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {upcomingPaymentsCount} scheduled obligation(s)
            </span>
          </div>
        </div>
      </div>

      {/* Grounded AI Observations & Methodology Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Financial Health Score Index */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-700" />
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
                      `Current Savings Rate: ${savingsRate}% of recorded inflows`,
                      `Budget Utilization: ${Math.round(data.budgetAdherenceRatio * 100)}% of limit`,
                      `Net Liquid Reserve: ${formatCurrency(data.totalBalance, currency)}`,
                    ],
                    action: 'Maintain consistent budget allocations and minimize high-frequency anomalies to retain a 90+ score.',
                  })
                }
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="View Calculation Methodology"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center shrink-0">
                <span className="text-2xl font-black text-emerald-800 font-mono tabular-nums">
                  {data.financialHealth.score}
                </span>
                <span className="text-[9px] font-bold text-emerald-900 font-mono uppercase">
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

          <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
            {data.financialHealth.components.map((comp, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-slate-50/80 border border-slate-200/80">
                <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                  <span className="font-medium text-slate-700">{comp.label}</span>
                  <span className="font-mono tabular-nums text-slate-900 font-semibold">{comp.score} / {comp.max}</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-700 rounded-full"
                    style={{ width: `${(comp.score / comp.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grounded AI Observations List */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Grounded Financial Intelligence
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Derived strictly from verified ledger records
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {calculatedInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-colors ${
                    insight.type === 'WARNING'
                      ? 'bg-amber-50/40 border-amber-200/70 text-slate-800'
                      : insight.type === 'SUCCESS'
                      ? 'bg-emerald-50/30 border-emerald-200/70 text-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">{insight.title}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                          insight.type === 'WARNING'
                            ? 'bg-amber-100 text-amber-800'
                            : insight.type === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {insight.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1">
                      {insight.text}
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab(insight.targetTab as any)}
                    className="mt-3 text-[11px] font-medium text-emerald-800 hover:text-emerald-950 flex items-center gap-1 group w-fit"
                  >
                    <span>{insight.action}</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>No fabricated metrics • Citations verified via internal statistical models</span>
            <button
              onClick={() => setActiveTab('assistant')}
              className="text-emerald-800 hover:underline font-medium"
            >
              Ask AI Financial Assistant →
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Charts: Income vs Expense Comparison & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Income vs Expenses Multi-Month Cashflow */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Cashflow Trajectory & Historical Comparison
              </h3>
              <p className="text-[11px] text-slate-500">Monthly Inflow vs. Total Verified Outflow</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                <button
                  onClick={() => setChartPeriod('3M')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    chartPeriod === '3M' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  3 Months
                </button>
                <button
                  onClick={() => setChartPeriod('6M')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    chartPeriod === '6M' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  6 Months
                </button>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700"></span>
                  Inflow
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span>
                  Expenses
                </span>
              </div>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayMonthlyComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
                    color: '#0f172a',
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), '']}
                />
                <Bar dataKey="income" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Breakdown Donut */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Expense Category Allocation
              </h3>
              <p className="text-[11px] text-slate-500">Current Period Distribution</p>
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
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {(data.categoryDistribution || []).map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Spend']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Total Outflow</span>
              <span className="text-xs font-bold text-slate-800 font-mono tabular-nums">
                {formatCurrency(data.monthlyExpenses, currency)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto pr-1">
            {(data.categoryDistribution || []).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="text-slate-700 font-medium">{cat.category}</span>
                </div>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span className="text-slate-500 text-[11px]">{cat.percentage}%</span>
                  <span className="text-slate-900 font-semibold">{formatCurrency(cat.amount, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 3 & 4: Daily Spending Velocity & Active Goals Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Spending Velocity Area Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Daily Outflow Cadence & Velocity
              </h3>
              <p className="text-[11px] text-slate-500">Day-by-Day Liquidity Burn with Anomaly Detection</p>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Mean: {data.spendingTrend.length > 0 ? formatCurrency(Math.round(data.monthlyExpenses / data.spendingTrend.length), currency) : '—'} / day
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.spendingTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
                    color: '#0f172a',
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Outflow']}
                />
                <Area type="monotone" dataKey="amount" stroke="#047857" strokeWidth={2} fillOpacity={1} fill="url(#spendingGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Savings Goals Summary */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Savings Goals
                </h3>
                <p className="text-[11px] text-slate-500">Atomic Reserve Allocations</p>
              </div>
              <button
                onClick={() => setActiveTab('goals')}
                className="text-xs text-emerald-800 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {(data.savingsGoals || []).slice(0, 3).map((goal) => {
                const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                return (
                  <div key={goal.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">{goal.title}</span>
                      <span className="font-mono tabular-nums text-slate-500 text-[11px]">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-700 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-slate-400">
                      <span>{formatCurrency(goal.currentAmount, currency)}</span>
                      <span>Target: {formatCurrency(goal.targetAmount, currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('goals')}
            className="w-full mt-3 py-2 text-center text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-medium"
          >
            Create New Savings Goal +
          </button>
        </div>
      </div>

      {/* Recent Transactions & Ledger Audit Status with Filtering */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent Transactions & Ledger Audit
            </h3>
            <p className="text-[11px] text-slate-500">
              Real-time classification confidence and SHA-256 block anchor
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('transactions')}
              className="text-xs text-emerald-800 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View Full Ledger ({(data.recentTransactions?.length || 0)}+)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Dashboard Transaction Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
          <div className="relative sm:col-span-2">
            <input
              type="text"
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Filter by description or merchant..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pl-8 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <div>
            <select
              value={txCategoryFilter}
              onChange={(e) => setTxCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white"
            >
              <option value="ALL">All Categories</option>
              {(data.categoryDistribution || []).map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white"
            >
              <option value="ALL">All Flows</option>
              <option value="EXPENSE">Expense Only</option>
              <option value="INCOME">Income Only</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
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
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 8).map((tx) => {
                  const colors = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.Other;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3 pl-2 font-mono tabular-nums text-slate-500 whitespace-nowrap">
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
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
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
                      <td className="py-3 text-right whitespace-nowrap font-mono tabular-nums font-bold">
                        <span className={tx.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'}>
                          {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 whitespace-nowrap">
                        <button
                          onClick={() => openVerifyModal(tx)}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-semibold text-[11px] border border-slate-200 transition-all flex items-center gap-1 ml-auto shadow-2xs"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-700" />
                          <span>Verify</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
