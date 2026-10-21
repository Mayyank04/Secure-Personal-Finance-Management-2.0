import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Receipt,
  CreditCard,
  Building,
  TrendingUp,
  Filter,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const CalendarView: React.FC = () => {
  const { currency, setActiveTab } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [activeView, setActiveView] = useState<'month' | 'timeline' | 'week'>('month');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [eventsData, setEventsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCalendar = async () => {
    try {
      setIsLoading(true);
      const res = await api.getCalendarEvents(selectedMonth);
      setEventsData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [selectedMonth, currency]);

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportIcs = async () => {
    try {
      setIsExporting(true);
      await api.downloadCalendarIcs();
    } catch (err: any) {
      alert('Failed to export calendar: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredEvents = (eventsData?.events || []).filter((e: any) => {
    if (statusFilter === 'ALL') return true;
    return e.status === statusFilter;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'BILL':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">BILL</span>;
      case 'SUBSCRIPTION':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">SUBSCRIPTION</span>;
      case 'LOAN_EMI':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">LOAN EMI</span>;
      case 'SALARY':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">SALARY</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">OTHER</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OVERDUE':
        return <span className="text-[10px] font-mono font-bold text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> OVERDUE</span>;
      case 'DUE_SOON':
        return <span className="text-[10px] font-mono font-bold text-amber-600 flex items-center gap-1"><Clock className="w-3 h-3" /> DUE SOON</span>;
      case 'PAID':
      case 'COMPLETED':
        return <span className="text-[10px] font-mono font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> COMPLETED</span>;
      default:
        return <span className="text-[10px] font-mono font-medium text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> UPCOMING</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Unified Financial Calendar & Obligations
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              RFC 5545
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cash-flow forecast timeline of upcoming bills, loan EMIs, subscription renewals, and payroll inflows
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportIcs}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="Download standard .ics calendar file"
          >
            <Download className={`w-3.5 h-3.5 text-indigo-600 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Exporting...' : 'Export .ICS Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-medium uppercase text-slate-500 tracking-wider">Payable in Month</span>
          <h3 className="text-lg font-bold font-mono text-slate-900 mt-1">
            {formatCurrency(eventsData?.summary?.totalPayable || 0, currency)}
          </h3>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-medium uppercase text-slate-500 tracking-wider">Due Soon (≤ 3 Days)</span>
          <h3 className="text-lg font-bold font-mono text-amber-600 mt-1">
            {eventsData?.summary?.dueSoonCount || 0} events
          </h3>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-medium uppercase text-slate-500 tracking-wider">Overdue</span>
          <h3 className="text-lg font-bold font-mono text-rose-600 mt-1">
            {eventsData?.summary?.overdueCount || 0} items
          </h3>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-medium uppercase text-slate-500 tracking-wider">Scheduled Inflows</span>
          <h3 className="text-lg font-bold font-mono text-emerald-600 mt-1">
            {formatCurrency(95000, currency)}
          </h3>
        </div>
      </div>

      {/* Filter and View Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveView('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'month' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Calendar Matrix
          </button>
          <button
            onClick={() => setActiveView('timeline')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'timeline' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Detailed Timeline
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="DUE_SOON">Due Soon (≤ 3 Days)</option>
            <option value="OVERDUE">Overdue Only</option>
            <option value="UPCOMING">Upcoming Schedule</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Main Calendar View Content */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-mono">Synchronizing financial events...</div>
      ) : activeView === 'month' ? (
        /* Calendar 30-Day Grid */
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">August 2026 Accounting & Commitment Schedule</h3>
            <span className="text-xs text-slate-500 font-mono">31 Days Active</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="text-center py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {day}
              </div>
            ))}

            {Array.from({ length: 31 }, (_, i) => {
              const dayNum = i + 1;
              const dateStr = `2026-08-${dayNum.toString().padStart(2, '0')}`;
              const dayEvents = (filteredEvents || []).filter((e: any) => e.date === dateStr);

              return (
                <div
                  key={dayNum}
                  className={`min-h-[90px] p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                    dayEvents.length > 0
                      ? 'bg-indigo-50/30 border-indigo-100 hover:border-indigo-300'
                      : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-slate-700">{dayNum}</span>
                    {dayEvents.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    )}
                  </div>

                  <div className="space-y-1 mt-1">
                    {dayEvents.slice(0, 2).map((evt: any) => (
                      <div
                        key={evt.id}
                        onClick={() => {
                          if (evt.category === 'BILL') setActiveTab('bills');
                          else if (evt.category === 'SUBSCRIPTION') setActiveTab('subscriptions');
                          else if (evt.category === 'LOAN_EMI') setActiveTab('debt');
                        }}
                        className="p-1 rounded-lg bg-white border border-slate-200 text-[9px] cursor-pointer hover:border-indigo-400 truncate shadow-2xs"
                        title={`${evt.title} - ${formatCurrency(evt.amount, currency)}`}
                      >
                        <span className="font-semibold text-slate-800 truncate">{evt.title}</span>
                        {evt.amount > 0 && (
                          <div className="font-mono text-slate-500 font-semibold">{formatCurrency(evt.amount, currency)}</div>
                        )}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-mono">+{dayEvents.length - 2} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Detailed Chronological Timeline List */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No events matched the selected filter.</div>
          ) : (
            filteredEvents.map((evt: any) => (
              <div key={evt.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 mt-0.5">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{evt.title}</h4>
                      {getCategoryBadge(evt.category)}
                      {getStatusBadge(evt.status)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Due: {formatDate(evt.date)} {evt.notes ? `• ${evt.notes}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <span className={`font-mono text-sm font-bold ${evt.category === 'SALARY' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {evt.amount > 0 ? formatCurrency(evt.amount, currency) : '—'}
                  </span>
                  <button
                    onClick={() => {
                      if (evt.category === 'BILL') setActiveTab('bills');
                      else if (evt.category === 'SUBSCRIPTION') setActiveTab('subscriptions');
                      else if (evt.category === 'LOAN_EMI') setActiveTab('debt');
                      else setActiveTab('dashboard');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors"
                    title="View details in module"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
