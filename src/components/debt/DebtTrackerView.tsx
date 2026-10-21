import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Percent,
  Calendar,
  CreditCard,
  Building2,
  TrendingDown,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Home,
  GraduationCap,
  Car,
  User,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Loan, LoanType, LoanStatus, FinancialAccount } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const DebtTrackerView: React.FC = () => {
  const { currency } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [summary, setSummary] = useState({
    totalPrincipal: 0,
    totalOutstanding: 0,
    totalMonthlyEmi: 0,
    weightedInterestRate: 0,
    activeLoansCount: 0,
    debtToIncomeRatio: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [formState, setFormState] = useState({
    loanName: '',
    lender: '',
    loanType: 'PERSONAL_LOAN' as LoanType,
    principal: '',
    outstandingBalance: '',
    interestRate: '',
    emi: '',
    dueDate: '5',
    startDate: new Date().toISOString().split('T')[0],
    maturityDate: new Date(Date.now() + 365 * 2 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  // EMI Pay Modal
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [emiAmount, setEmiAmount] = useState<string>('');
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [isSubmittingEmi, setIsSubmittingEmi] = useState<boolean>(false);

  const fetchLoans = async () => {
    try {
      setIsLoading(true);
      const res = await api.getLoans();
      setLoans(res.loans || []);
      setSummary(
        res.summary || {
          totalPrincipal: 0,
          totalOutstanding: 0,
          totalMonthlyEmi: 0,
          weightedInterestRate: 0,
          activeLoansCount: 0,
          debtToIncomeRatio: 0,
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
    fetchLoans();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingLoan(null);
    setFormState({
      loanName: '',
      lender: '',
      loanType: 'PERSONAL_LOAN',
      principal: '',
      outstandingBalance: '',
      interestRate: '',
      emi: '',
      dueDate: '5',
      startDate: new Date().toISOString().split('T')[0],
      maturityDate: new Date(Date.now() + 365 * 2 * 86400000).toISOString().split('T')[0],
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (loan: Loan) => {
    setEditingLoan(loan);
    setFormState({
      loanName: loan.loanName,
      lender: loan.lender,
      loanType: loan.loanType,
      principal: loan.principal.toString(),
      outstandingBalance: loan.outstandingBalance.toString(),
      interestRate: loan.interestRate.toString(),
      emi: loan.emi.toString(),
      dueDate: loan.dueDate,
      startDate: loan.startDate,
      maturityDate: loan.maturityDate,
      notes: loan.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLoan) {
        await api.updateLoan(editingLoan.id, {
          loanName: formState.loanName,
          lender: formState.lender,
          loanType: formState.loanType,
          principal: Number(formState.principal),
          outstandingBalance: Number(formState.outstandingBalance),
          interestRate: Number(formState.interestRate),
          emi: Number(formState.emi),
          dueDate: formState.dueDate,
          startDate: formState.startDate,
          maturityDate: formState.maturityDate,
          notes: formState.notes,
        });
      } else {
        await api.createLoan({
          loanName: formState.loanName,
          lender: formState.lender,
          loanType: formState.loanType,
          principal: Number(formState.principal),
          outstandingBalance:
            Number(formState.outstandingBalance) || Number(formState.principal),
          interestRate: Number(formState.interestRate),
          emi: Number(formState.emi),
          dueDate: formState.dueDate,
          startDate: formState.startDate,
          maturityDate: formState.maturityDate,
          notes: formState.notes,
        });
      }
      setIsModalOpen(false);
      fetchLoans();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmPayEmi = async () => {
    if (!payingLoan) return;
    try {
      setIsSubmittingEmi(true);
      await api.recordLoanPayment(payingLoan.id, {
        paymentAmount: Number(emiAmount),
        accountId: payAccountId || accounts[0]?.id,
        paymentMethod: 'Bank Transfer',
        notes: `EMI Payment for ${payingLoan.loanName}`,
      });
      setPayingLoan(null);
      fetchLoans();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingEmi(false);
    }
  };

  const handleDeleteLoan = async (id: string, name: string) => {
    if (!window.confirm(`Delete loan entry "${name}"?`)) return;
    try {
      await api.deleteLoan(id);
      fetchLoans();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getLoanIcon = (type: LoanType) => {
    switch (type) {
      case 'HOME_LOAN':
        return Home;
      case 'EDUCATION_LOAN':
        return GraduationCap;
      case 'VEHICLE_LOAN':
        return Car;
      case 'CREDIT_CARD':
        return CreditCard;
      default:
        return User;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <TrendingDown className="w-7 h-7 text-indigo-600" />
            Debt & Loan Payoff Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track loans, amortization progress, monthly EMI commitments, interest rates, and accelerated payoff milestones.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Loan / Liability
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Outstanding Debt</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            ₹{summary.totalOutstanding.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Principal: ₹{summary.totalPrincipal.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Monthly EMI Commitment</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{summary.totalMonthlyEmi.toLocaleString('en-IN')}/mo
          </p>
          <p className="text-xs text-slate-400 mt-1">Fixed monthly obligations</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Weighted Interest Rate</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-indigo-700 mt-2 font-mono">
            {summary.weightedInterestRate}% p.a.
          </p>
          <p className="text-xs text-slate-400 mt-1">Across all active facilities</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Debt-to-Income (DTI)</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {summary.debtToIncomeRatio}%
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            {summary.debtToIncomeRatio < 35 ? 'Healthy ratio (< 35%)' : 'Caution (> 35%)'}
          </p>
        </div>
      </div>

      {/* Loans Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-sm font-medium">Loading loans and liabilities...</p>
        </div>
      ) : loans.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Zero active debt liabilities</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            You are completely debt-free! If you take a loan or vehicle finance, add it here to track amortization.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Loan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {loans.map(loan => {
            const Icon = getLoanIcon(loan.loanType);
            const payoffPct = Math.min(
              100,
              Math.round(((loan.principal - loan.outstandingBalance) / loan.principal) * 100)
            );

            return (
              <div
                key={loan.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">{loan.loanName}</h4>
                        <p className="text-xs text-slate-500 font-medium">
                          {loan.lender} • {loan.loanType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(loan)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLoan(loan.id, loan.loanName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Balance & Progress Bar */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Outstanding Balance</span>
                      <span className="font-bold font-mono text-rose-600 text-base">
                        ₹{loan.outstandingBalance.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>Paid: ₹{(loan.principal - loan.outstandingBalance).toLocaleString('en-IN')}</span>
                        <span className="font-semibold text-indigo-600">{payoffPct}% Principal Cleared</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${payoffPct}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div>
                        <div className="text-slate-400">Monthly EMI</div>
                        <div className="font-bold font-mono text-slate-800 mt-0.5">
                          ₹{loan.emi.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Interest Rate</div>
                        <div className="font-bold font-mono text-indigo-700 mt-0.5">
                          {loan.interestRate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Due Day</div>
                        <div className="font-bold font-mono text-slate-800 mt-0.5">
                          Day {loan.dueDate}
                        </div>
                      </div>
                    </div>
                  </div>

                  {loan.notes && (
                    <p className="mt-2 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                      "{loan.notes}"
                    </p>
                  )}
                </div>

                {/* Footer Pay Button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Matures: {loan.maturityDate}
                  </span>

                  <button
                    onClick={() => {
                      setPayingLoan(loan);
                      setEmiAmount(loan.emi.toString());
                      setPayAccountId(accounts[0]?.id || '');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Record EMI Payment
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EMI Settlement Modal */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record EMI Payment</h3>
                  <p className="text-xs text-slate-500">{payingLoan.loanName} ({payingLoan.lender})</p>
                </div>
              </div>
              <button onClick={() => setPayingLoan(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={emiAmount}
                  onChange={e => setEmiAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-sm"
                />
              </div>

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

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                ✓ Deducts ₹{Number(emiAmount || 0).toLocaleString('en-IN')} from outstanding debt balance.<br />
                ✓ Generates transaction in the ledger and anchors with SHA-256 state hash on blockchain.
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setPayingLoan(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayEmi}
                disabled={isSubmittingEmi || !emiAmount}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 shadow-xs"
              >
                {isSubmittingEmi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingLoan ? 'Edit Loan Facility' : 'Add Loan Facility'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loan / Facility Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Home Loan, Axis Auto Finance"
                  value={formState.loanName}
                  onChange={e => setFormState({ ...formState, loanName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lending Institution</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Bank, SBI"
                    value={formState.lender}
                    onChange={e => setFormState({ ...formState, lender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loan Type</label>
                  <select
                    value={formState.loanType}
                    onChange={e => setFormState({ ...formState, loanType: e.target.value as LoanType })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="PERSONAL_LOAN">Personal Loan</option>
                    <option value="HOME_LOAN">Home Loan</option>
                    <option value="EDUCATION_LOAN">Education Loan</option>
                    <option value="VEHICLE_LOAN">Vehicle Loan</option>
                    <option value="CREDIT_CARD">Credit Card Debt</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sanctioned Principal (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500000"
                    value={formState.principal}
                    onChange={e => setFormState({ ...formState, principal: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Outstanding (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 350000"
                    value={formState.outstandingBalance}
                    onChange={e => setFormState({ ...formState, outstandingBalance: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Interest %</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 8.5"
                    value={formState.interestRate}
                    onChange={e => setFormState({ ...formState, interestRate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly EMI (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 12500"
                    value={formState.emi}
                    onChange={e => setFormState({ ...formState, emi: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Day</label>
                  <input
                    type="text"
                    placeholder="e.g. 5"
                    value={formState.dueDate}
                    onChange={e => setFormState({ ...formState, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formState.startDate}
                    onChange={e => setFormState({ ...formState, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Maturity Date</label>
                  <input
                    type="date"
                    required
                    value={formState.maturityDate}
                    onChange={e => setFormState({ ...formState, maturityDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
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
                  {editingLoan ? 'Save Changes' : 'Register Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
