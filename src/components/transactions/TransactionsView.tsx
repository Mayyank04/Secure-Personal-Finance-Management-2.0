import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  ShieldCheck,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  FileText,
  Camera,
  Mic,
  Building2,
} from 'lucide-react';
import { Transaction, TransactionCategory, TransactionType, PaymentMethod, FinancialAccount } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, formatDate, truncateHash, CATEGORY_COLORS } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const TransactionsView: React.FC = () => {
  const { currency, openVerifyModal, setIsReceiptModalOpen, setIsVoiceModalOpen } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalCount: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);

  // Add / Edit Form State
  const [formData, setFormData] = useState<{
    description: string;
    amount: string;
    type: TransactionType;
    category: TransactionCategory;
    paymentMethod: PaymentMethod;
    merchant: string;
    date: string;
    notes: string;
    isRecurring: boolean;
    accountId?: string;
  }>({
    description: '',
    amount: '',
    type: 'EXPENSE',
    category: 'Food',
    paymentMethod: 'Credit Card',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    isRecurring: false,
    accountId: '',
  });

  // AI Real-time Live Categorization Preview
  const [aiPreview, setAiPreview] = useState<{
    predictedCategory: string;
    confidence: number;
    extractedMerchant: string;
    explanation: string;
  } | null>(null);
  const [isPreviewingAi, setIsPreviewingAi] = useState<boolean>(false);

  // Import State
  const [importText, setImportText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      };

      if (search) params.search = search;
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedType !== 'ALL') params.type = selectedType;
      if (selectedPaymentMethod !== 'ALL') params.paymentMethod = selectedPaymentMethod;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.getTransactions(params);
      setTransactions(res.transactions);
      setPagination(res.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    api.getAccounts().then(res => setAccounts(res.accounts || [])).catch(() => {});
  }, [
    pagination.page,
    selectedCategory,
    selectedType,
    selectedPaymentMethod,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  ]);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((p) => ({ ...p, page: 1 }));
      fetchTransactions();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Live AI Categorization Preview as user types description
  useEffect(() => {
    if (!formData.description || formData.description.length < 3) {
      setAiPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsPreviewingAi(true);
        const res = await api.previewCategorization({
          description: formData.description,
          amount: Number(formData.amount) || 100,
          type: formData.type,
        });
        setAiPreview(res);
        if (!editingTx && !formData.merchant && res.extractedMerchant) {
          setFormData((f) => ({ ...f, merchant: res.extractedMerchant }));
        }
      } catch {
        // ignore
      } finally {
        setIsPreviewingAi(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [formData.description, formData.amount, formData.type]);

  const handleOpenAddModal = () => {
    setEditingTx(null);
    setFormData({
      description: '',
      amount: '',
      type: 'EXPENSE',
      category: 'Food',
      paymentMethod: 'Credit Card',
      merchant: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      isRecurring: false,
      accountId: accounts.length > 0 ? accounts[0].id : '',
    });
    setAiPreview(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setFormData({
      description: tx.description,
      amount: tx.amount.toString(),
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      merchant: tx.merchant,
      date: tx.date,
      notes: tx.notes || '',
      isRecurring: tx.isRecurring || false,
      accountId: tx.accountId || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    try {
      if (editingTx) {
        await api.updateTransaction(editingTx.id, {
          ...formData,
          amount: Number(formData.amount),
        });
      } else {
        await api.createTransaction({
          ...formData,
          amount: Number(formData.amount),
          category: formData.category || (aiPreview?.predictedCategory as any) || 'Other',
        });
      }
      setIsAddModalOpen(false);
      fetchTransactions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Delete this transaction from your private database?')) {
      try {
        await api.deleteTransaction(id);
        fetchTransactions();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleBatchImport = async () => {
    if (!importText.trim()) return;
    try {
      setIsImporting(true);
      setImportStatus(null);

      let items: any[] = [];
      if (importText.trim().startsWith('[') || importText.trim().startsWith('{')) {
        const parsed = JSON.parse(importText);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // Simple CSV parser
        const lines = importText.trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 3) {
            items.push({
              date: cols[0] || new Date().toISOString().split('T')[0],
              description: cols[1],
              amount: parseFloat(cols[2]) || 100,
              category: cols[3] || undefined,
              type: cols[4]?.toUpperCase() || 'EXPENSE',
              paymentMethod: cols[5] || 'Credit Card',
            });
          }
        }
      }

      const res = await api.importTransactions(items);
      setImportStatus(`Successfully verified and anchored ${res.count} transactions to blockchain!`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportText('');
        setImportStatus(null);
        fetchTransactions();
      }, 1500);
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message || 'Invalid format'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const allCategories: TransactionCategory[] = [
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
    'Insurance',
    'Investment',
    'Salary',
    'Freelance',
    'Other',
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial Transactions Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time AI categorization & SHA-256 Hyperledger audit anchoring
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsReceiptModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs transition-all"
            title="Scan Receipt / Invoice"
          >
            <Camera className="w-3.5 h-3.5 text-indigo-600" />
            <span>Scan Receipt</span>
          </button>
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs transition-all"
            title="Voice Expense Input"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-600" />
            <span>Voice Entry</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, merchant, or notes..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="ALL">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="ALL">All Flow Types</option>
              <option value="EXPENSE">Expense Outflows</option>
              <option value="INCOME">Income Inflows</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => {
                setSelectedPaymentMethod(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="UPI / Instant Transfer">UPI / Instant Transfer</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Net Banking">Net Banking</option>
            </select>
          </div>
        </div>

        {/* Date Filter & Clear Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
            />
            {(startDate || endDate || selectedCategory !== 'ALL' || selectedType !== 'ALL' || search) && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('ALL');
                  setSelectedType('ALL');
                  setSelectedPaymentMethod('ALL');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-indigo-600 hover:text-indigo-700 text-xs underline ml-2 font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="text-slate-500 text-xs">
            Showing <strong className="text-slate-800">{transactions.length}</strong> of{' '}
            <strong className="text-slate-800">{pagination.totalCount}</strong> records
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-mono">Loading encrypted transaction vault...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-700">No transactions match your search filter</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your date range, search query, or record a new transaction above.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pl-2 cursor-pointer" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="pb-3">Description & Merchant</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">AI Confidence</th>
                    <th className="pb-3">Blockchain Digest</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const colors = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.Other;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-3 pl-2 font-mono text-slate-500 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-3 pr-2">
                          <div className="font-semibold text-slate-900 truncate max-w-xs">{tx.description}</div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                            <span>{tx.merchant}</span>
                            <span>•</span>
                            <span>{tx.paymentMethod}</span>
                            {tx.accountId && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-700 border border-slate-200">
                                {accounts.find(a => a.id === tx.accountId)?.name || 'Account'}
                              </span>
                            )}
                            {tx.isRecurring && <span className="text-indigo-600 font-medium">• Recurring</span>}
                          </div>
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                              (tx.aiConfidence || 95) >= 90
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : (tx.aiConfidence || 95) >= 70
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                            title={`Categorization confidence: ${tx.aiConfidence || 95}%`}
                          >
                            {tx.aiConfidence || 95}% match
                          </span>
                        </td>
                        <td className="py-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            <span title={tx.blockchainHash} className="text-slate-700">{truncateHash(tx.blockchainHash, 6, 4)}</span>
                            <span className="text-[9px] text-slate-400 font-mono">(Blk #{tx.blockNumber})</span>
                          </div>
                        </td>
                        <td className="py-3 text-right whitespace-nowrap font-mono font-bold">
                          <span className={tx.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'}>
                            {tx.type === 'INCOME' ? '+' : '-'}
                            {formatCurrency(tx.amount, currency)}
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openVerifyModal(tx)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-medium text-[11px] border border-slate-200 transition-all flex items-center gap-1 group/btn"
                              title="Audit SHA-256 On Blockchain"
                            >
                              <ShieldCheck className="w-3 h-3 text-indigo-600 group-hover/btn:text-white" />
                              <span>Verify</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(tx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 text-xs">
              <span className="text-slate-500">
                Page <strong className="text-slate-800">{pagination.page}</strong> of{' '}
                <strong className="text-slate-800">{pagination.totalPages || 1}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingTx ? 'Edit Transaction & Re-anchor' : 'Record New Transaction'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-categorized by AI and anchored to Hyperledger Fabric
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Description</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Nature Basket Groceries, Netflix Subscription, Salary"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                />
              </div>

              {/* Real-time AI Categorization Preview Box */}
              {aiPreview && (
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 animate-in fade-in transition-all ${
                    aiPreview.confidence >= 90
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : aiPreview.confidence >= 70
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-rose-50/70 border-rose-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Sparkles className={`w-4 h-4 ${aiPreview.confidence >= 90 ? 'text-emerald-600' : aiPreview.confidence >= 70 ? 'text-amber-600' : 'text-rose-600'}`} />
                      <span>AI Classification:</span>
                      <span className="px-2 py-0.5 rounded bg-white font-mono font-bold text-slate-900 border border-slate-200 shadow-2xs">
                        {aiPreview.predictedCategory}
                      </span>
                      {aiPreview.subcategory && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600 border border-slate-200">
                          {aiPreview.subcategory}
                        </span>
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                        aiPreview.confidence >= 90
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : aiPreview.confidence >= 70
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {aiPreview.confidence}% Confidence
                    </span>
                  </div>

                  {aiPreview.confidence < 70 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-800 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Category uncertain — please review and verify manually.</span>
                    </div>
                  )}

                  {aiPreview.reasons && aiPreview.reasons.length > 0 ? (
                    <div className="space-y-1 pt-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reasoning Factors:</p>
                      <ul className="space-y-0.5">
                        {aiPreview.reasons.map((r, idx) => (
                          <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                            <span className="text-slate-400 mt-0.5">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {aiPreview.explanation}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, category: aiPreview.predictedCategory as any }))}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-[11px] font-semibold transition-all shadow-2xs"
                    >
                      ✓ Accept ({aiPreview.predictedCategory})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiPreview(null)}
                      className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 text-[11px]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 2400"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Flow Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="EXPENSE">Expense Outflow</option>
                    <option value="INCOME">Income Inflow</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category (or Override)</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Financial Account</label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="">Default / Unlinked</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution} {acc.maskedIdentifier})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="UPI / Instant Transfer">UPI / Instant Transfer</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Merchant / Entity</label>
                  <input
                    type="text"
                    value={formData.merchant}
                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                    placeholder="e.g. Swiggy, Netflix, Apex Inc"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes / Reference</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional memo or invoice #"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="recCheck"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="recCheck" className="text-xs text-slate-700 cursor-pointer">
                  Mark as recurring regular commitment (e.g. monthly bill or subscription)
                </label>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Upon submission, a canonical SHA-256 fingerprint is immediately committed to the Hyperledger ledger block tree.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
                  {editingTx ? 'Save & Re-anchor Block' : 'Commit to Encrypted Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV / JSON Batch Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Batch Statement Import</h3>
                  <p className="text-xs text-slate-500">Import CSV or JSON format with automatic blockchain anchoring</p>
                </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">Paste CSV or JSON payload:</span>
                <button
                  type="button"
                  onClick={() =>
                    setImportText(
                      `date,description,amount,category,type,paymentMethod\n2026-08-27,Blue Tokai Coffee Roast,420,Food,EXPENSE,Credit Card\n2026-08-28,Freelance Web Development,35000,Freelance,INCOME,Bank Transfer`
                    )
                  }
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Paste Sample CSV
                </button>
              </div>

              <textarea
                rows={7}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`date,description,amount,category,type,paymentMethod\n2026-08-20,Groceries at Supermart,2450,Groceries,EXPENSE,UPI`}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />

              {importStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    importStatus.includes('failed')
                      ? 'bg-rose-50 border border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}
                >
                  {importStatus.includes('failed') ? <AlertTriangle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  <span>{importStatus}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting || !importText.trim()}
                  onClick={handleBatchImport}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs disabled:opacity-40 flex items-center gap-2"
                >
                  {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{isImporting ? 'Processing Batch...' : 'Process & Anchor Hashes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
