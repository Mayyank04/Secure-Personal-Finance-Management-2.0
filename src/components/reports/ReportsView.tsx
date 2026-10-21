import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export const ReportsView: React.FC = () => {
  const { currency, user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const months = [
    { value: '2026-08', label: 'August 2026' },
    { value: '2026-07', label: 'July 2026' },
    { value: '2026-06', label: 'June 2026' },
    { value: '2026-05', label: 'May 2026' },
    { value: '2026-04', label: 'April 2026' },
    { value: '2026-03', label: 'March 2026' },
  ];

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const res = await api.getMonthlyReport(selectedMonth);
      setReportData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, currency]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!reportData) return;
    try {
      setIsGeneratingPdf(true);
      const doc = new jsPDF();
      const monthLabel = months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

      // Header Banner
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('SECURE PERSONAL FINANCE MANAGEMENT SYSTEM', 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Official Monthly Financial Statement & Blockchain Cryptographic Attestation`, 14, 23);
      doc.text(`Accounting Period: ${monthLabel} | Generated: ${new Date().toISOString().split('T')[0]}`, 14, 29);

      // Account & Ledger Metadata Box
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Account Dossier & Security Credentials', 14, 46);

      autoTable(doc, {
        startY: 50,
        head: [['Account Holder', 'User ID', 'Ledger Channel', 'Block Height']],
        body: [
          [
            reportData.user?.name || user?.name || 'Verified User',
            reportData.user?.id || user?.id || 'usr-demo-fintech-01',
            reportData.cryptographicSeal?.ledgerChannel || 'fintech-audit-channel',
            `#${reportData.cryptographicSeal?.blockHeight || 41}`,
          ],
        ],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
      });

      // Executive Summary Table
      const summaryY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Executive Financial Performance', 14, summaryY);

      autoTable(doc, {
        startY: summaryY + 4,
        head: [['Metric Description', 'Value (INR ₹)']],
        body: [
          ['Total Inflows (Verified Income)', formatCurrency(reportData.summary?.totalIncome || 0, currency)],
          ['Total Outflows (Recorded Expenses)', formatCurrency(reportData.summary?.totalExpense || 0, currency)],
          ['Net Savings / Cashflow', formatCurrency(reportData.summary?.netSavings || 0, currency)],
          ['Savings Velocity (Net Ratio)', `${reportData.summary?.savingsRate || 0}%`],
          ['Total Transactions Processed', `${reportData.summary?.transactionCount || 0} items`],
          ['Flagged Statistical Anomalies', `${reportData.summary?.anomalyCount || 0} events`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });

      // Category Spending Breakdown Table
      const catY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Verified Category Spending Breakdown', 14, catY);

      const categoryRows = (reportData.categoryBreakdown || []).map((c: any) => [
        c.category,
        formatCurrency(c.amount, currency),
        `${c.percentage}%`,
      ]);

      autoTable(doc, {
        startY: catY + 4,
        head: [['Expense Category', 'Amount Spent', '% of Outflows']],
        body: categoryRows.length > 0 ? categoryRows : [['No expenses recorded for this period', '₹0', '0%']],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });

      // Flagged Anomalies Table (if present)
      let currentY = (doc as any).lastAutoTable.finalY + 8;
      if (reportData.anomaliesSummary && reportData.anomaliesSummary.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('3. Flagged AI Statistical Outliers & Security Reviews', 14, currentY);

        const anomalyRows = reportData.anomaliesSummary.map((a: any) => [
          a.description,
          formatDate(a.date),
          a.category,
          formatCurrency(a.amount, currency),
          `${a.deviation}x baseline`,
        ]);

        autoTable(doc, {
          startY: currentY + 4,
          head: [['Transaction', 'Date', 'Category', 'Amount', 'Statistical Deviation']],
          body: anomalyRows,
          theme: 'grid',
          headStyles: { fillColor: [225, 29, 72], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // Cryptographic Attestation Box
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, currentY, 182, 38, 3, 3, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, currentY, 182, 38, 3, 3, 'S');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('HYPERLEDGER FABRIC CRYPTOGRAPHIC NON-REPUDIATION SEAL', 18, currentY + 7);

      doc.setFontSize(7.5);
      doc.setFont('courier', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Canonical SHA-256 Digest: ${reportData.cryptographicSeal?.sha256Attestation || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}`, 18, currentY + 14);
      doc.text(`Membership Service Provider (MSP): ${reportData.cryptographicSeal?.mspId || 'FintechOrg1MSP'}`, 18, currentY + 20);
      doc.text(`Timestamp: ${reportData.cryptographicSeal?.timestamp || new Date().toISOString()}`, 18, currentY + 26);
      doc.text(`Consensus: Raft PBFT Multi-Peer Quorum Verified (Block #${reportData.cryptographicSeal?.blockHeight || 41})`, 18, currentY + 32);

      // Save PDF
      doc.save(`Monthly-Financial-Statement-${selectedMonth}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Financial Statements & Cryptographic Attestation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready monthly balance sheet, income statement, and Hyperledger merkle seal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500 shadow-xs"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            {isGeneratingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isGeneratingPdf ? 'Compiling PDF...' : 'Download PDF Statement'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Statement Paper Preview Document */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-mono">Generating cryptographic audit statement from permissioned ledger simulation...</p>
        </div>
      ) : !reportData ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
          No statement data available for this billing period.
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-xs max-w-4xl mx-auto">
          {/* Statement Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest">
                  VERIFIED FINTECH AUDIT STATEMENT
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                {months.find((m) => m.value === selectedMonth)?.label || selectedMonth} Financial Statement
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Account Holder: <strong className="text-slate-800">{reportData.user?.name || user?.name}</strong> • Account ID: {reportData.user?.id || user?.id}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left sm:text-right font-mono text-[11px]">
              <span className="text-slate-500 uppercase block text-[10px]">Hyperledger State Digest</span>
              <span className="text-indigo-600 font-bold block select-all truncate max-w-xs sm:max-w-none">
                {reportData.cryptographicSeal?.sha256Attestation?.slice(0, 16)}...
              </span>
              <span className="text-slate-400 text-[9px] block">
                Block #{reportData.cryptographicSeal?.blockHeight || 41} • {reportData.cryptographicSeal?.channelId || 'fintech-audit-channel'}
              </span>
            </div>
          </div>

          {/* Section 1: Executive Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase">Total Inflows</span>
              <span className="text-base font-bold text-emerald-700 font-mono">
                {formatCurrency(reportData.summary?.totalIncome || 0, currency)}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase">Total Outflows</span>
              <span className="text-base font-bold text-slate-900 font-mono">
                {formatCurrency(reportData.summary?.totalExpense || 0, currency)}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase">Net Savings</span>
              <span className="text-base font-bold text-indigo-600 font-mono">
                {formatCurrency(reportData.summary?.netSavings || 0, currency)}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase">Savings Rate</span>
              <span className="text-base font-bold text-emerald-600 font-mono">
                {reportData.summary?.savingsRate || 0}%
              </span>
            </div>
          </div>

          {/* Section 2: Expense Distribution */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Category Expenditures & Outflow Distribution
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2 text-left">Category</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(reportData.categoryBreakdown || []).map((cat: any) => (
                  <tr key={cat.category} className="hover:bg-slate-50">
                    <td className="py-2.5 font-sans font-medium text-slate-800">{cat.category}</td>
                    <td className="py-2.5 text-right text-slate-900 font-bold">{formatCurrency(cat.amount, currency)}</td>
                    <td className="py-2.5 text-right text-slate-500">{cat.percentage}%</td>
                  </tr>
                ))}
                <tr className="py-2.5 font-bold bg-slate-50">
                  <td className="py-2.5 pl-2 font-sans text-slate-900">Total Monthly Verified Expenditures</td>
                  <td className="py-2.5 pr-2 text-right text-rose-600">
                    {formatCurrency(reportData.summary?.totalExpense || 0, currency)}
                  </td>
                  <td className="py-2.5 pr-2 text-right text-slate-700">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Flagged Anomalies if any */}
          {reportData.anomaliesSummary && reportData.anomaliesSummary.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Flagged AI Statistical Anomalies ({reportData.anomaliesSummary.length} Events)
                </h3>
              </div>
              <div className="space-y-2">
                {reportData.anomaliesSummary.map((anom: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-2xl bg-rose-50/50 border border-rose-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{anom.description}</span>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        {formatDate(anom.date)} • Category: {anom.category}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-slate-900">{formatCurrency(anom.amount, currency)}</span>
                      <span className="text-[10px] text-rose-700 block font-semibold">{anom.deviation}× Baseline</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cryptographic Attestation Footer */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cryptographic Non-Repudiation Certificate</span>
            </div>
            <p className="leading-relaxed font-mono text-[10px]">
              SHA-256 Digest: <span className="text-slate-900 font-bold select-all">{reportData.cryptographicSeal?.sha256Attestation}</span>
            </p>
            <p className="text-[10px] text-slate-400">
              Anchored to permissioned Hyperledger Fabric channel <code>fintech-audit-channel</code> via 3-peer Raft quorum consensus.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
