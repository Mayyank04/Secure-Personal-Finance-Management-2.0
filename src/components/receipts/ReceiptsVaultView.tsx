import React, { useState, useEffect, useRef } from 'react';
import {
  Receipt,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Link,
  Plus,
  RefreshCw,
  Trash2,
  FileText,
  Eye,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Unlink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { ReceiptRecord, Transaction, FinancialAccount, TransactionCategory } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const ReceiptsVaultView: React.FC = () => {
  const { currency, openVerifyModal } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({
    totalReceipts: 0,
    needsReviewCount: 0,
    linkedCount: 0,
    unlinkedCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [createNewTx, setCreateNewTx] = useState<boolean>(true);
  const [linkAccountId, setLinkAccountId] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);

  const [editMerchant, setEditMerchant] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editTax, setEditTax] = useState<string>('');
  const [editCategory, setEditCategory] = useState<TransactionCategory>('Groceries');
  const [editDate, setEditDate] = useState<string>('');

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      const res = await api.getReceipts();
      setReceipts(res.receipts || []);
      setSummary(
        res.summary || {
          totalReceipts: 0,
          needsReviewCount: 0,
          linkedCount: 0,
          unlinkedCount: 0,
        }
      );

      const [accRes, txRes] = await Promise.all([
        api.getAccounts(),
        api.getTransactions({ limit: '100' }),
      ]);
      setAccounts(accRes.accounts || []);
      setTransactions(txRes.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const res = await api.uploadReceipt({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
          });
          fetchReceipts();
          if (res.receipt) {
            handleOpenReceiptDetails(res.receipt);
          }
        } catch (err: any) {
          alert('OCR Processing failed: ' + err.message);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  const handleOpenReceiptDetails = (rc: ReceiptRecord) => {
    setSelectedReceipt(rc);
    setEditMerchant(rc.merchant);
    setEditAmount(rc.amount.toString());
    setEditTax(rc.tax.toString());
    setEditCategory(rc.category);
    setEditDate(rc.date);
  };

  const handleSaveCorrections = async () => {
    if (!selectedReceipt) return;
    try {
      const res = await api.updateReceipt(selectedReceipt.id, {
        merchant: editMerchant,
        amount: Number(editAmount),
        tax: Number(editTax),
        category: editCategory,
        date: editDate,
        processingStatus: selectedReceipt.linkedTransactionId ? 'LINKED' : 'UNLINKED',
      });
      setSelectedReceipt(res.receipt);
      fetchReceipts();
      alert('Receipt corrections saved.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLinkTransaction = async () => {
    if (!selectedReceipt) return;
    try {
      setIsLinking(true);
      await api.linkReceipt(selectedReceipt.id, {
        transactionId: createNewTx ? undefined : selectedTxId,
        createNewTransaction: createNewTx,
        accountId: linkAccountId || accounts[0]?.id,
        paymentMethod: 'Credit Card',
      });
      setIsLinkModalOpen(false);
      setSelectedReceipt(null);
      fetchReceipts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (rc: ReceiptRecord) => {
    try {
      await api.unlinkReceipt(rc.id);
      fetchReceipts();
      if (selectedReceipt?.id === rc.id) {
        setSelectedReceipt(null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    if (!window.confirm('Delete this receipt record?')) return;
    try {
      await api.deleteReceipt(id);
      fetchReceipts();
      if (selectedReceipt?.id === id) setSelectedReceipt(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-indigo-600" />
            Receipt Vault & AI OCR Itemizer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Store digital proofs, extract line items with OCR confidence telemetry, and link receipts directly to ledger transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept="image/*,.pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning with OCR...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Upload Receipt / Invoice
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Stored Receipts</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{summary.totalReceipts}</p>
          <p className="text-xs text-slate-400 mt-1">Audit-ready document archive</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Needs Review (&lt; 70% conf)</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{summary.needsReviewCount}</p>
          <p className="text-xs text-amber-600 mt-1">Manual review recommended</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Linked to Transactions</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{summary.linkedCount}</p>
          <p className="text-xs text-emerald-600 mt-1">Anchored in block ledger</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Unlinked Proofs</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Link className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{summary.unlinkedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Ready for transaction matching</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-sm font-medium">Loading receipt vault...</p>
        </div>
      ) : receipts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Your Receipt Vault is empty</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Upload bill receipts, grocery slips, or invoices. Our OCR engine automatically extracts items, merchant names, and taxes.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <UploadCloud className="w-4 h-4" />
            Upload First Receipt
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {receipts.map(rc => {
            const isLowConf = rc.ocrConfidence < 0.7;
            const isLinked = rc.processingStatus === 'LINKED';

            return (
              <div
                key={rc.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{rc.merchant}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        {rc.date} • {rc.category}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenReceiptDetails(rc)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                        title="View / Edit OCR Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteReceipt(rc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                        title="Delete Receipt"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Receipt Total</div>
                      <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                        ₹{rc.amount.toLocaleString('en-IN')}
                      </div>
                      {rc.tax > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          (Includes ₹{rc.tax} tax)
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-medium">OCR Confidence</div>
                      <div
                        className={`text-xs font-bold font-mono mt-0.5 ${
                          isLowConf ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {Math.round(rc.ocrConfidence * 100)}%
                      </div>
                    </div>
                  </div>

                  {rc.items && rc.items.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Extracted Items ({rc.items.length})
                      </div>
                      <div className="max-h-20 overflow-y-auto divide-y divide-slate-100 text-[11px] text-slate-600">
                        {rc.items.slice(0, 3).map((it, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span className="truncate pr-2">{it.description}</span>
                            <span className="font-mono font-medium shrink-0">₹{it.total}</span>
                          </div>
                        ))}
                        {rc.items.length > 3 && (
                          <div className="text-[10px] text-slate-400 italic pt-1">
                            +{rc.items.length - 3} more items...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {isLinked ? (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Linked to Ledger</span>
                    </div>
                  ) : isLowConf ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      NEEDS REVIEW
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Unlinked</span>
                  )}

                  <div className="flex items-center gap-2">
                    {isLinked ? (
                      <button
                        onClick={() => handleUnlink(rc)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <Unlink className="w-3 h-3" />
                        Unlink
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedReceipt(rc);
                          setIsLinkModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                      >
                        <Link className="w-3.5 h-3.5" />
                        Link Transaction
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedReceipt && !isLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Receipt OCR Details & Review</h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            {selectedReceipt.ocrConfidence < 0.7 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  OCR Confidence is low ({Math.round(selectedReceipt.ocrConfidence * 100)}%). Please verify the extracted merchant name and total amount before linking.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Extracted Metadata
                </h4>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Merchant Name</label>
                  <input
                    type="text"
                    value={editMerchant}
                    onChange={e => setEditMerchant(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Total Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tax Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editTax}
                      onChange={e => setEditTax(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Receipt Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value as TransactionCategory)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="Groceries">Groceries</option>
                      <option value="Food">Food</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Transport">Transport</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveCorrections}
                  className="w-full py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800"
                >
                  Save Corrections
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Itemized Breakdown ({selectedReceipt.items?.length || 0})
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-2 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReceipt.items?.map((it, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-3">{it.description}</td>
                          <td className="py-1.5 px-2 text-center text-slate-400 font-mono">
                            {it.qty || 1}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-medium">
                            ₹{it.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-500 max-h-24 overflow-y-auto font-mono">
                  <span className="font-bold text-slate-700 block mb-1">RAW OCR BUFFER:</span>
                  {selectedReceipt.ocrText}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">ID: {selectedReceipt.id}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  onClick={() => setIsLinkModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Link to Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLinkModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Link Receipt to Ledger</h3>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="font-bold text-indigo-900 text-sm">{selectedReceipt.merchant}</div>
                <div className="text-indigo-700 font-mono">
                  Amount: ₹{selectedReceipt.amount.toLocaleString('en-IN')} • Date: {selectedReceipt.date}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="linkType"
                    checked={createNewTx}
                    onChange={() => setCreateNewTx(true)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Create new expense transaction from this receipt
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="linkType"
                    checked={!createNewTx}
                    onChange={() => setCreateNewTx(false)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Attach proof to an existing recorded transaction
                  </span>
                </label>
              </div>

              {createNewTx ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Charge from Financial Account
                  </label>
                  <select
                    value={linkAccountId}
                    onChange={e => setLinkAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Existing Transaction
                  </label>
                  <select
                    value={selectedTxId}
                    onChange={e => setSelectedTxId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-[11px]"
                  >
                    <option value="">Select a transaction...</option>
                    {transactions.map(tx => (
                      <option key={tx.id} value={tx.id}>
                        {tx.date} - {tx.description} (₹{tx.amount})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkTransaction}
                disabled={isLinking || (!createNewTx && !selectedTxId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isLinking ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Anchoring Link...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Commit Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
