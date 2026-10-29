import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Calendar,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { DashboardData } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const AnalyticsView: React.FC = () => {
  const { currency } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    api.getDashboard().then((res) => {
      setData(res);
      setIsLoading(false);
    });
  }, [currency]);

  if (isLoading || !data) {
    return <div className="p-12 text-center text-xs text-slate-500 font-mono">Loading Analytics Matrix...</div>;
  }

  const burnRateData = [
    { month: 'Jun', discretionary: 34200, fixed: 48000, savings: 37800 },
    { month: 'Jul', discretionary: 39500, fixed: 48000, savings: 32500 },
    { month: 'Aug', discretionary: 38000, fixed: 48000, savings: 34000 },
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Financial Analytics & Capital Velocity
          </h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            ANALYTICS ENGINE
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Multi-period spend distribution, savings rates, and capital allocation velocity
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Capital Allocation & Savings Velocity (Jun – Aug 2026)
            </h3>
            <p className="text-[11px] text-slate-500">Fixed Commitments vs Discretionary Outflow vs Savings Stashed</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span> Fixed
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Discretionary
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Savings
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={burnRateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                formatter={(v: any) => [formatCurrency(Number(v), currency), '']}
              />
              <Bar dataKey="fixed" stackId="a" fill="#4f46e5" maxBarSize={48} />
              <Bar dataKey="discretionary" stackId="a" fill="#f59e0b" maxBarSize={48} />
              <Bar dataKey="savings" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Category Spending Distribution
          </h3>
          <div className="space-y-3">
            {data.categoryDistribution.map((cat, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">{cat.category}</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatCurrency(cat.amount, currency)} ({cat.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${cat.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Savings Rate & Emergency Runway
          </h3>
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Monthly Net Inflow Rate</span>
              <h4 className="text-xl font-bold text-emerald-600 font-mono mt-1">28.3%</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Higher than the 20% fintech benchmark recommendation.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Emergency Runway Buffer</span>
              <h4 className="text-xl font-bold text-indigo-600 font-mono mt-1">4.2 Months</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Liquid cash reserves cover 4.2 months of fixed recurring expenditures.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
