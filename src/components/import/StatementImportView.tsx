import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCw,
  Layers,
  ShieldCheck,
  Building2,
  ArrowRight,
  Download,
  Info,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api';
import { FinancialAccount } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const StatementImportView: React.FC = () => {
  const { currency, openVerifyModal } = useAuth();
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [rawCSV, setRawCSV] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);

  // Column Mapping
  const [mapping, setMapping] = useState({
    date: 'date',
    description: 'description',
    amount: 'amount',
    type: 'type',
    category: 'category',
  });

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ message: string; importedCount: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    api.getAccounts().then(res => {
      setAccounts(res.accounts || []);
      if (res.accounts && res.accounts.length > 0) {
        setSelectedAccountId(res.accounts[0].id);
      }
    });
  }, []);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setRawCSV(text);
      handleParsePreview(text);
    };
    reader.readAsText(file);
  };

  const handleParsePreview = async (csvText?: string) => {
    const content = csvText || rawCSV;
    if (!content.trim()) return;

    try {
      setIsPreviewing(true);
      setImportResult(null);
      const res = await api.previewCSV({
        csvContent: content,
        customMapping: mapping,
      });
      setPreviewResult(res);

      // Preselect non-duplicate rows
      const nonDupKeys = (res.rows || [])
        .filter((r: any) => !r.isDuplicate)
        .map((_: any, idx: number) => `row-${idx}`);
      setSelectedRowIds(nonDupKeys);
    } catch (err: any) {
      alert('CSV Parsing failed: ' + err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewResult || selectedRowIds.length === 0) return;
    try {
      setIsImporting(true);
      const rowsToImport = previewResult.rows.filter((_: any, idx: number) =>
        selectedRowIds.includes(`row-${idx}`)
      );

      const res = await api.confirmCSVImport({
        accountId: selectedAccountId || undefined,
        rows: rowsToImport,
      });

      setImportResult(res);
      setPreviewResult(null);
      setRawCSV('');
      setFileName('');
      setSelectedRowIds([]);
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const loadSampleCSV = () => {
    const sample = `Date,Description,Amount,Type,Category
2026-03-01,Whole Foods Market,142.50,EXPENSE,Groceries
2026-03-02,Starbucks Coffee,6.75,EXPENSE,Food
2026-03-03,Salary Direct Deposit,5000.00,INCOME,Salary
2026-03-04,Uber Trip,24.80,EXPENSE,Transport
2026-03-05,Netflix Subscription,19.99,EXPENSE,Subscriptions`;
    setRawCSV(sample);
    setFileName('sample_bank_statement.csv');
    handleParsePreview(sample);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
            Bank Statement & CSV Importer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Import statements from any bank or financial institution with flexible column mapping, duplicate detection, and instant blockchain anchoring.
          </p>
        </div>

        <button
          onClick={loadSampleCSV}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-slate-500" />
          Load Sample Statement
        </button>
      </div>

      {importResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
          <div className="font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{importResult.message}</span>
          </div>
          <p className="pl-7 text-emerald-700">
            {importResult.importedCount} transactions were cryptographically signed and added to your financial ledger.
          </p>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="p-8 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-3xl bg-white hover:bg-indigo-50/20 transition-all cursor-pointer text-center space-y-3"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".csv,.txt"
              className="hidden"
            />
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit mx-auto">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {fileName ? `Selected: ${fileName}` : 'Drop your CSV statement here, or browse files'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports HDFC, ICICI, SBI, Chase, Amex, and standard CSV formats
              </p>
            </div>
          </div>

          {/* Or Paste Raw CSV */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Or Paste Raw CSV Data
            </label>
            <textarea
              rows={4}
              value={rawCSV}
              onChange={e => setRawCSV(e.target.value)}
              placeholder="Date,Description,Amount,Type,Category&#10;2026-03-01,Supermarket,54.20,EXPENSE,Groceries"
              className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end">
              <button
                onClick={() => handleParsePreview()}
                disabled={!rawCSV.trim() || isPreviewing}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isPreviewing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Parsing CSV...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    Parse & Preview Table
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Account Selector & Instructions */}
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Target Financial Account
            </h3>
            <p className="text-xs text-slate-500">
              Select which bank account or card balance should reflect these imported statement transactions:
            </p>

            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.institution} - {acc.maskedIdentifier})
                </option>
              ))}
            </select>

            <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Every imported transaction is verified and anchored on Hyperledger Fabric.</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>Exact duplicates with matching date, amount & merchant are automatically flagged.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Preview Table */}
      {previewResult && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Statement Preview ({previewResult.totalRows} rows parsed)
              </h3>
              <p className="text-xs text-slate-500">
                {previewResult.duplicatesFound} potential duplicate(s) detected. Uncheck any items you do not wish to import.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewResult(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
              <button
                onClick={handleCommitImport}
                disabled={selectedRowIds.length === 0 || isImporting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-xs"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Committing to Ledger...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Commit {selectedRowIds.length} Transactions
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Import</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Predicted Category</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewResult.rows.map((row: any, idx: number) => {
                  const rowKey = `row-${idx}`;
                  const isChecked = selectedRowIds.includes(rowKey);
                  return (
                    <tr
                      key={rowKey}
                      className={`hover:bg-slate-50 ${
                        row.isDuplicate ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedRowIds([...selectedRowIds, rowKey]);
                            } else {
                              setSelectedRowIds(selectedRowIds.filter(id => id !== rowKey));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{row.date}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{row.description}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {row.predictedCategory}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[10px]">
                        {row.type}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          row.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {row.type === 'INCOME' ? '+' : '-'}₹{row.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.isDuplicate ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            DUPLICATE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            READY
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
