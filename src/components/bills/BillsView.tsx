import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Building2,
  ShieldCheck,
  Zap,
  Check,
  Filter,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Bill, BillStatus, BillFrequency, TransactionCategory, FinancialAccount } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const BillsView: React.FC = () => {
  const { currency, openVerifyModal } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [summary, setSummary] = useState({
    totalBills: 0,
    upcomingAmount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    paidCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    merchant: '',
    amount: '',
    category: 'Utilities' as TransactionCategory,
    dueDate: new Date().toISOString().split('T')[0],
    frequency: 'MONTHLY' as BillFrequency,
    accountId: '',
    autoPaid: false,
    notes: '',
  });

  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [recordTx, setRecordTx] = useState<boolean>(true);
  const [isSubmittingPay, setIsSubmittingPay] = useState<boolean>(false);

  const fetchBills = async () => {
    try {
      setIsLoading(true);
      const res = await api.getBills();
      setBills(res.bills || []);
      setSummary(
        res.summary || {
          totalBills: 0,
          upcomingAmount: 0,
          overdueCount: 0,
          dueSoonCount: 0,
          paidCount: 0,
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
    fetchBills();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingBill(null);
    setFormState({
      name: '',
      merchant: '',
      amount: '',
      category: 'Utilities',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      frequency: 'MONTHLY',
      accountId: accounts[0]?.id || '',
      autoPaid: false,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: Bill) => {
    setEditingBill(b);
    setFormState({
      name: b.name,
      merchant: b.merchant,
      amount: b.amount.toString(),
      category: b.category,
      dueDate: b.dueDate,
      frequency: b.frequency,
      accountId: b.accountId || '',
      autoPaid: !!b.autoPaid,
      notes: b.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBill) {
        await api.updateBill(editingBill.id, {
          name: formState.name,
          merchant: formState.merchant,
          amount: Number(formState.amount),
          category: formState.category,
          dueDate: formState.dueDate,
          frequency: formState.frequency,
          accountId: formState.accountId || undefined,
          autoPaid: formState.autoPaid,
          notes: formState.notes,
        });
      } else {
        await api.createBill({
          name: formState.name,
          merchant: formState.merchant || formState.name,
          amount: Number(formState.amount),
          category: formState.category,
          dueDate: formState.dueDate,
          frequency: formState.frequency,
          accountId: formState.accountId || undefined,
          autoPaid: formState.autoPaid,
          notes: formState.notes,
        });
      }
      setIsModalOpen(false);
      fetchBills();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmPayBill = async () => {
    if (!payingBill) return;
    try {
      setIsSubmittingPay(true);
      await api.payBill(payingBill.id, {
        recordTransaction: recordTx,
        accountId: payAccountId || payingBill.accountId,
      });
      setPayingBill(null);
      fetchBills();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleDeleteBill = async (id: string, name: string) => {
    if (!window.confirm(`Delete bill "${name}"?`)) return;
    try {
      await api.deleteBill(id);
      fetchBills();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredBills = bills.filter(b => {
    if (filterStatus === 'ALL') return true;
    return b.status === filterStatus;
  });

  const getStatusBadge = (status: BillStatus) => {
    switch (status) {
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            OVERDUE
          </span>
        );
      case 'DUE_SOON':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            DUE SOON
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            PAID
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Calendar className="w-3 h-3" />
            UPCOMING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-indigo-600" />
            Bills & Recurring Payables
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track utility bills, credit card statements, rents, and recurring due dates with one-click ledger settlements.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Bill
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Upcoming Obligations</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{summary.upcomingAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">Due within current cycle</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Due Soon (≤ 3 Days)</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            {summary.dueSoonCount} <span className="text-xs text-slate-400 font-normal">Pending</span>
          </p>
          <p className="text-xs text-amber-600 mt-1">Requires immediate attention</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Overdue Bills</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{summary.overdueCount}</p>
          <p className="text-xs text-rose-500 mt-1">Late payment penalty risk</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Settled / Paid</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{summary.paidCount}</p>
          <p className="text-xs text-emerald-600 mt-1">Verified on blockchain ledger</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Bills' },
          { id: 'DUE_SOON', label: 'Due Soon (≤ 3 Days)' },
          { id: 'UPCOMING', label: 'Upcoming' },
          { id: 'OVERDUE', label: 'Overdue' },
          { id: 'PAID', label: 'Paid / Settled' },
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

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-sm font-medium">Loading bills and recurring payables...</p>
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No bills in this view</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            You are all caught up! Add a new bill reminder to never miss a due date.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Bill
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBills.map(bill => {
            const isPaid = bill.status === 'PAID';
            return (
              <div
                key={bill.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 text-sm">{bill.name}</h4>
                        {bill.autoPaid && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            AUTO-PAY
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        {bill.merchant} • {bill.category}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(bill)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBill(bill.id, bill.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Due Date</div>
                      <div className="text-xs font-bold font-mono text-slate-900 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        {bill.dueDate}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-medium">Bill Amount</div>
                      <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                        ₹{bill.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {bill.accountName && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Paying from: {bill.accountName}</span>
                    </div>
                  )}

                  {bill.notes && (
                    <p className="mt-2 text-[11px] text-slate-500 italic bg-slate-50/50 p-2 rounded-lg">
                      "{bill.notes}"
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {getStatusBadge(bill.status)}

                  {!isPaid ? (
                    <button
                      onClick={() => {
                        setPayingBill(bill);
                        setPayAccountId(bill.accountId || accounts[0]?.id || '');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Pay Bill
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Settled
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Settle Bill Payment</h3>
                  <p className="text-xs text-slate-500">{payingBill.name}</p>
                </div>
              </div>
              <button onClick={() => setPayingBill(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-800 font-medium">Payment Amount</span>
                <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5">
                  ₹{payingBill.amount.toLocaleString('en-IN')}
                </div>
              </div>
              <span className="text-xs text-emerald-700 font-semibold">{payingBill.merchant}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deduct from Account</label>
                <select
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (₹{acc.currentBalance.toLocaleString('en-IN')} available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="recordTx"
                  checked={recordTx}
                  onChange={e => setRecordTx(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="recordTx" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Generate transaction in ledger and anchor with SHA-256 state hash on blockchain
                </label>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setPayingBill(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayBill}
                disabled={isSubmittingPay}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2 shadow-xs"
              >
                {isSubmittingPay ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Settling...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Settlement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingBill ? 'Edit Bill Reminder' : 'Add Bill Reminder'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill, Apartment Rent, Broadband"
                  value={formState.name}
                  onChange={e => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Merchant / Biller</label>
                  <input
                    type="text"
                    placeholder="e.g. BESCOM, Airtel"
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
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={formState.dueDate}
                    onChange={e => setFormState({ ...formState, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Frequency</label>
                  <select
                    value={formState.frequency}
                    onChange={e =>
                      setFormState({ ...formState, frequency: e.target.value as BillFrequency })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="ONE_TIME">One-Time</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Linked Account</label>
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoPaidCheck"
                  checked={formState.autoPaid}
                  onChange={e => setFormState({ ...formState, autoPaid: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="autoPaidCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Auto-debit / Auto-pay enabled with biller
                </label>
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
                  {editingBill ? 'Save Changes' : 'Create Bill Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
