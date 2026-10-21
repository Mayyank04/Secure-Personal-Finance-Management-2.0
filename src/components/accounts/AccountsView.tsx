import React, { useState, useEffect } from 'react';
import {
  Building2,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Layers,
  ChevronRight,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  Landmark,
  Smartphone,
  Banknote,
  PieChart,
} from 'lucide-react';
import { api } from '../../lib/api';
import { FinancialAccount, AccountType, AccountStatus, Transaction } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const AccountsView: React.FC = () => {
  const { currency, openVerifyModal } = useAuth();
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [summary, setSummary] = useState<{
    totalAssets: number;
    totalLiabilities: number;
    netLiquidBalance: number;
    accountCount: number;
  }>({ totalAssets: 0, totalLiabilities: 0, netLiquidBalance: 0, accountCount: 0 });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  // Account creation / edit modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    institution: '',
    accountType: 'BANK' as AccountType,
    maskedIdentifier: '',
    openingBalance: '',
    creditLimit: '',
  });

  // Sandbox Connector State
  const [isSandboxOpen, setIsSandboxOpen] = useState<boolean>(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [syncPreview, setSyncPreview] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedSyncRows, setSelectedSyncRows] = useState<string[]>([]);
  const [targetSyncAccountId, setTargetSyncAccountId] = useState<string>('');
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Selected Account for Transaction Drawer
  const [inspectedAccount, setInspectedAccount] = useState<FinancialAccount | null>(null);
  const [accountTransactions, setAccountTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAccounts();
      setAccounts(res.accounts || []);
      setSummary({
        totalAssets: res.totalAssets || 0,
        totalLiabilities: res.totalLiabilities || 0,
        netLiquidBalance: res.netLiquidBalance || 0,
        accountCount: res.accountCount || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await api.getSandboxProviders();
      setProviders(res.providers || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchProviders();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingAccount(null);
    setFormState({
      name: '',
      institution: '',
      accountType: 'BANK',
      maskedIdentifier: '',
      openingBalance: '',
      creditLimit: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setFormState({
      name: acc.name,
      institution: acc.institution,
      accountType: acc.accountType,
      maskedIdentifier: acc.maskedIdentifier,
      openingBalance: acc.openingBalance.toString(),
      creditLimit: acc.creditLimit ? acc.creditLimit.toString() : '',
    });
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await api.updateAccount(editingAccount.id, {
          name: formState.name,
          institution: formState.institution,
          maskedIdentifier: formState.maskedIdentifier,
          creditLimit: formState.creditLimit ? Number(formState.creditLimit) : undefined,
        });
      } else {
        await api.createAccount({
          name: formState.name,
          institution: formState.institution,
          accountType: formState.accountType,
          maskedIdentifier: formState.maskedIdentifier,
          openingBalance: Number(formState.openingBalance) || 0,
          creditLimit: formState.creditLimit ? Number(formState.creditLimit) : undefined,
          currency,
        });
      }
      setIsModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from your portfolio?`)) return;
    try {
      await api.deleteAccount(id);
      fetchAccounts();
      if (inspectedAccount?.id === id) setInspectedAccount(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleInspectAccount = async (acc: FinancialAccount) => {
    setInspectedAccount(acc);
    setLoadingTx(true);
    try {
      const res = await api.getAccountTransactions(acc.id);
      setAccountTransactions(res.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTx(false);
    }
  };

  // Sandbox Sync Flow
  const handleStartSandboxSync = async (provider: any) => {
    setSelectedProvider(provider);
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const result = await api.syncSandbox(provider.id);
      setSyncPreview(result);
      // Pre-select non-duplicates
      const nonDupIds = (result.previewItems || [])
        .filter((it: any) => !it.isDuplicate)
        .map((it: any) => it.externalId);
      setSelectedSyncRows(nonDupIds);
      if (accounts.length > 0) {
        setTargetSyncAccountId(accounts[0].id);
      }
    } catch (err: any) {
      setSyncFeedback('Sync simulation error: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCommitSandboxImport = async () => {
    if (!syncPreview || selectedSyncRows.length === 0) return;
    try {
      setIsSyncing(true);
      const itemsToImport = syncPreview.previewItems.filter((it: any) =>
        selectedSyncRows.includes(it.externalId)
      );

      const res = await api.importSandboxTransactions({
        accountId: targetSyncAccountId || accounts[0]?.id,
        accountName: accounts.find(a => a.id === targetSyncAccountId)?.name,
        transactions: itemsToImport,
      });

      setSyncFeedback(
        `✓ ${res.message} Anchored with SHA-256 state hashes on Fabric Ledger.`
      );
      setSyncPreview(null);
      setSelectedSyncRows([]);
      fetchAccounts();
    } catch (err: any) {
      setSyncFeedback('Failed to commit import: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    if (filterType === 'ALL') return true;
    return acc.accountType === filterType;
  });

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'BANK':
        return Landmark;
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return CreditCard;
      case 'UPI':
        return Smartphone;
      case 'CASH':
        return Banknote;
      case 'INVESTMENT':
        return TrendingUp;
      default:
        return Wallet;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Summary Cards */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Financial Accounts & Sandbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your bank accounts, credit cards, UPI wallets, cash reserves, and synthetic sandbox connectors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSandboxOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            Synthetic Bank Sandbox
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Liquid Assets</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{summary.totalAssets.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">Cash, Savings & UPI balances</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Liabilities</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            ₹{summary.totalLiabilities.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">Outstanding credit card balance</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Net Liquid Position</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-indigo-700 mt-2 font-mono">
            ₹{summary.netLiquidBalance.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">Assets minus short-term liabilities</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Linked Accounts</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {summary.accountCount} <span className="text-xs text-slate-400 font-normal">Active Profiles</span>
          </p>
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Hyperledger Fabric Anchored
          </p>
        </div>
      </div>

      {/* Account Type Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Accounts' },
          { id: 'BANK', label: 'Bank Accounts' },
          { id: 'CREDIT_CARD', label: 'Credit Cards' },
          { id: 'DEBIT_CARD', label: 'Debit Cards' },
          { id: 'UPI', label: 'UPI / Digital' },
          { id: 'CASH', label: 'Cash Reserves' },
          { id: 'INVESTMENT', label: 'Investments' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              filterType === f.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-sm font-medium">Loading financial accounts...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No accounts in this category</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Add a new bank account, credit card, or UPI wallet to track transactions and balances seamlessly.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAccounts.map(acc => {
            const Icon = getAccountIcon(acc.accountType);
            const isCredit = acc.accountType === 'CREDIT_CARD';

            return (
              <div
                key={acc.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl ${
                          isCredit
                            ? 'bg-rose-50 text-rose-600'
                            : acc.accountType === 'UPI'
                            ? 'bg-purple-50 text-purple-600'
                            : acc.accountType === 'CASH'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">{acc.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">
                          {acc.institution} • <span className="font-mono">{acc.maskedIdentifier}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {acc.isDemo && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          DEMO
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenEditModal(acc)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                        title="Edit Account"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id, acc.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                        title="Delete Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Balance Display */}
                  <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium">
                      {isCredit ? 'Current Outstanding Balance' : 'Current Available Balance'}
                    </div>
                    <div
                      className={`text-xl font-bold font-mono mt-0.5 ${
                        isCredit ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      ₹{acc.currentBalance.toLocaleString('en-IN')}
                    </div>

                    {isCredit && acc.creditLimit && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Limit: ₹{acc.creditLimit.toLocaleString('en-IN')}</span>
                        <span className="text-indigo-600 font-semibold">
                          Available: ₹{acc.availableBalance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {acc.status}
                  </span>

                  <button
                    onClick={() => handleInspectAccount(acc)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    View History
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Account Transactions Drawer / Inspector */}
      {inspectedAccount && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Transactions: {inspectedAccount.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {inspectedAccount.institution} • {inspectedAccount.maskedIdentifier} • Current Balance: ₹{inspectedAccount.currentBalance.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setInspectedAccount(null)}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
            >
              Close
            </button>
          </div>

          {loadingTx ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
              <p className="text-xs">Fetching account ledger entries...</p>
            </div>
          ) : accountTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No transactions recorded for this account yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Ledger Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{tx.date}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{tx.description}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tx.type === 'INCOME'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          tx.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'INCOME' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => openVerifyModal(tx)}
                          className="font-mono text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100"
                          title={tx.blockchainHash}
                        >
                          {tx.blockchainHash.slice(0, 10)}...
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Synthetic Sandbox Modal */}
      {isSandboxOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Synthetic Bank & UPI Sandbox Connector
                  </h3>
                  <p className="text-xs text-purple-700 font-medium">
                    SYNTHETIC / DEMO ENVIRONMENT: Zero live banking credentials or real money.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSandboxOpen(false);
                  setSyncPreview(null);
                  setSyncFeedback(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            {syncFeedback && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncFeedback}</span>
              </div>
            )}

            {!syncPreview ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Select a synthetic institution sandbox to simulate realistic banking feeds, UPI settlements, and duplicate detection tests:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {providers.map(prov => (
                    <div
                      key={prov.id}
                      onClick={() => handleStartSandboxSync(prov)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer transition-all flex flex-col justify-between group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{prov.icon}</span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{prov.name}</h4>
                            <p className="text-[11px] text-slate-500 font-medium">{prov.description}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-purple-700 font-semibold group-hover:underline">
                        <span>Simulate Sync Feed</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-purple-900">{selectedProvider?.name}</span>
                    <span className="text-purple-700 ml-2 font-mono">
                      ({syncPreview.previewItems.length} transactions generated, {syncPreview.duplicatesDetected} duplicate(s) detected)
                    </span>
                  </div>
                  <button
                    onClick={() => setSyncPreview(null)}
                    className="text-purple-700 underline font-semibold"
                  >
                    Change Provider
                  </button>
                </div>

                {/* Target Account Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign to Financial Account
                  </label>
                  <select
                    value={targetSyncAccountId}
                    onChange={e => setTargetSyncAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution} - {acc.maskedIdentifier})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Select</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {syncPreview.previewItems.map((item: any) => {
                        const isSelected = selectedSyncRows.includes(item.externalId);
                        return (
                          <tr
                            key={item.externalId}
                            className={`hover:bg-slate-50 ${
                              item.isDuplicate ? 'bg-amber-50/40 text-slate-500' : ''
                            }`}
                          >
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedSyncRows([...selectedSyncRows, item.externalId]);
                                  } else {
                                    setSelectedSyncRows(
                                      selectedSyncRows.filter(id => id !== item.externalId)
                                    );
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-3 font-mono">{item.date}</td>
                            <td className="py-2 px-3 font-medium">{item.merchant || item.cleanDescription}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                                {item.predictedCategory}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              ₹{item.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-3">
                              {item.isDuplicate ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                  Duplicate
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                  New
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedSyncRows.length} transaction(s) selected for import
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSyncPreview(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCommitSandboxImport}
                      disabled={selectedSyncRows.length === 0 || isSyncing}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Importing & Anchoring...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Commit to Blockchain Ledger
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingAccount ? 'Edit Financial Account' : 'Add Financial Account'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Salary Account, Amazon Pay ICICI"
                  value={formState.name}
                  onChange={e => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Financial Institution</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, ICICI Bank, State Bank of India"
                  value={formState.institution}
                  onChange={e => setFormState({ ...formState, institution: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    disabled={!!editingAccount}
                    value={formState.accountType}
                    onChange={e =>
                      setFormState({ ...formState, accountType: e.target.value as AccountType })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                    <option value="UPI">UPI Wallet</option>
                    <option value="CASH">Cash Reserve</option>
                    <option value="INVESTMENT">Investment</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Masked ID</label>
                  <input
                    type="text"
                    placeholder="•••• 8421"
                    value={formState.maskedIdentifier}
                    onChange={e => setFormState({ ...formState, maskedIdentifier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {!editingAccount && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Opening / Initial Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formState.openingBalance}
                    onChange={e => setFormState({ ...formState, openingBalance: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              )}

              {formState.accountType === 'CREDIT_CARD' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 200000"
                    value={formState.creditLimit}
                    onChange={e => setFormState({ ...formState, creditLimit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              )}

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
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
