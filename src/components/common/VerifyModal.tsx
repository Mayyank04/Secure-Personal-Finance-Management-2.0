import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Cpu,
  Database,
  RefreshCw,
  X,
  Layers,
  Calendar,
  FileCode,
  Check,
  Copy,
} from 'lucide-react';
import { Transaction, VerificationResult } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, formatDate, truncateHash } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface VerifyModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const VerifyModal: React.FC<VerifyModalProps> = ({ transaction, onClose }) => {
  const { currency } = useAuth();
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCanonicalJson, setShowCanonicalJson] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!transaction) return;

    let isMounted = true;
    setIsVerifying(true);
    setError(null);
    setResult(null);

    api.verifyTransaction(transaction.id)
      .then((res) => {
        if (isMounted) {
          setResult(res);
          setIsVerifying(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Verification could not be completed.');
          setIsVerifying(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [transaction]);

  if (!transaction) return null;

  const canonicalPayload = {
    id: transaction.id,
    userId: transaction.userId,
    date: transaction.date,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    merchant: transaction.merchant,
  };

  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Cryptographic Transaction Verification</h3>
              <p className="text-xs text-slate-500">Hyperledger Fabric Permissioned Ledger Proof</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-indigo-700 uppercase tracking-wider font-semibold">
                {transaction.category}
              </span>
              <h4 className="text-sm font-semibold text-slate-900 mt-0.5">{transaction.description}</h4>
              <p className="text-xs text-slate-500">{formatDate(transaction.date)} • {transaction.merchant}</p>
            </div>
            <div className="text-right">
              <span className="text-base font-bold text-slate-900 font-mono">
                {formatCurrency(transaction.amount, currency)}
              </span>
              <p className="text-xs text-slate-500 font-mono">ID: {transaction.id}</p>
            </div>
          </div>

          {isVerifying ? (
            <div className="p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-semibold text-indigo-950">Computing Cryptographic Verification...</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Retrieving off-chain payload, normalizing canonical keys, calculating SHA-256 fingerprint, and comparing against Hyperledger block state...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <h4 className="text-sm font-semibold text-rose-900">Verification Request Error</h4>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
              </div>
            </div>
          ) : result?.verified ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-emerald-900">VALID — INTEGRITY VERIFIED</h4>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-100 text-emerald-800 rounded border border-emerald-200 font-semibold">
                    100% SHA-256 MATCH
                  </span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  The recalculation of SHA-256(canonical JSON) matches the immutable hash anchored on Block #{result.blockNumber}. No database tampering has occurred.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-rose-900">MISMATCH DETECTED — INTEGRITY COMPROMISED</h4>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-rose-100 text-rose-800 rounded border border-rose-200 font-semibold">
                    HASH MISMATCH
                  </span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  {result?.diagnosticMessage || 'The off-chain private record values do not match the immutable hash on the blockchain ledger.'}
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3 font-mono text-xs">
              <div className="text-xs font-semibold font-sans text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Proof Breakdown & Ledger Attributes</span>
                <span className="font-mono text-slate-400">Channel: {result.channelId || 'fintech-audit-channel'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span>Anchored Block Height</span>
                    <Layers className="w-3 h-3 text-indigo-600" />
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    Block #{result.blockNumber >= 0 ? result.blockNumber : 'N/A'}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span>Validation Timestamp</span>
                    <Calendar className="w-3 h-3 text-purple-600" />
                  </div>
                  <div className="font-semibold text-slate-900 text-xs">
                    {formatDate(new Date().toISOString())}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Database className="w-3 h-3 text-indigo-600" />
                      Off-Chain Recalculated Hash
                    </span>
                    <button
                      onClick={() => handleCopyHash(result.recalculatedHash)}
                      className="text-slate-400 hover:text-slate-700 flex items-center gap-1 font-mono text-[9px]"
                    >
                      {copied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-xl bg-white text-[11px] text-slate-800 break-all select-all border border-slate-200">
                    {result.recalculatedHash}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      On-Chain Ledger Anchor
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{result.mspId || 'FintechOrg1MSP'}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white text-[11px] text-slate-800 break-all select-all border border-slate-200">
                    {result.blockchainHash}
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => setShowCanonicalJson(!showCanonicalJson)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-sans font-semibold"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{showCanonicalJson ? 'Hide Canonical JSON Payload' : 'Inspect Canonical Hash Input JSON'}</span>
                </button>

                {showCanonicalJson && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-emerald-400 text-[10px] overflow-x-auto select-all">
                    {JSON.stringify(canonicalPayload, null, 2)}
                  </pre>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs font-sans text-slate-600">
                <Cpu className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900">Zero Raw Data on Chain:</strong> No transaction descriptions, merchant identities, or personal amounts are ever broadcasted to the blockchain. Only canonical cryptographic SHA-256 evidence is preserved.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-xs text-slate-500 font-mono">
            MSP: <span className="text-slate-700 font-semibold">{result?.mspId || 'FintechOrg1MSP'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            Close Audit Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
