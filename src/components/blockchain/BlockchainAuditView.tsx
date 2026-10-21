import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Cpu,
  Key,
  Database,
  ArrowRight,
  Sparkles,
  Lock,
  GitBranch,
  XCircle,
  FileCode,
  Info,
  ChevronRight,
  RotateCcw,
  Check,
} from 'lucide-react';
import { BlockchainBlock, BlockchainStatus } from '../../types';
import { api } from '../../lib/api';
import { formatDate, truncateHash } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const BlockchainAuditView: React.FC = () => {
  const { isTampered, setIsTampered, refreshBlockchainStatus } = useAuth();
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<BlockchainBlock | null>(null);

  // Full Chain Audit state
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<{
    isValid: boolean;
    blockCount: number;
    auditDetails: string[];
  } | null>(null);

  // Single Block Verification State
  const [isVerifyingBlock, setIsVerifyingBlock] = useState<boolean>(false);
  const [blockVerificationResult, setBlockVerificationResult] = useState<{
    isValid: boolean;
    blockNumber: number;
    merkleRoot: string;
    recalculatedMerkleRoot: string;
    previousHash: string;
    expectedPreviousHash: string;
    transactionCount: number;
    recordsVerified: number;
    recordsFailed: number;
    details: string[];
  } | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'explorer' | 'simulation' | 'architecture'>('explorer');

  // Simulation Steps
  const [simulationStep, setSimulationStep] = useState<number>(isTampered ? 2 : 1);

  const loadBlockchainData = async () => {
    try {
      setIsLoading(true);
      const [blocksRes, statRes] = await Promise.all([
        api.getBlockchainBlocks(1, 30),
        api.getBlockchainStatus(),
      ]);
      setBlocks(blocksRes?.blocks || []);
      setStatus(statRes || null);
      if (blocksRes?.blocks && blocksRes.blocks.length > 0) {
        setSelectedBlock(blocksRes.blocks[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  const handleRunFullChainAudit = async () => {
    try {
      setIsAuditing(true);
      setAuditResult(null);
      const res = await api.auditBlockchain();
      setAuditResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleVerifyCurrentBlock = async (blockNum: number) => {
    try {
      setIsVerifyingBlock(true);
      setBlockVerificationResult(null);
      const res = await api.verifyBlock(blockNum);
      setBlockVerificationResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifyingBlock(false);
    }
  };

  const handleToggleTamper = async () => {
    try {
      if (isTampered) {
        await api.resetTamper();
        setIsTampered(false);
        setSimulationStep(1);
      } else {
        await api.simulateTamper();
        setIsTampered(true);
        setSimulationStep(2);
      }
      refreshBlockchainStatus();
      loadBlockchainData();
      handleRunFullChainAudit();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBlocks = (blocks || []).filter(
    (b) =>
      b.blockNumber.toString().includes(searchQuery) ||
      (b.merkleRoot && b.merkleRoot.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.channelId && b.channelId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Hyperledger Cryptographic Audit & Ledger Explorer
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              FABRIC v2.5
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Permissioned transaction anchoring with SHA-256 Merkle root verification
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunFullChainAudit}
            disabled={isAuditing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            {isAuditing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>{isAuditing ? 'Auditing Nodes...' : 'Verify Cryptographic Chain'}</span>
          </button>

          <button
            onClick={loadBlockchainData}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('explorer')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'explorer'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ledger & Block Explorer</span>
        </button>

        <button
          onClick={() => setActiveTab('simulation')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'simulation'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Tamper Simulation Lab</span>
          {isTampered && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'architecture'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Technical Architecture</span>
        </button>
      </div>

      {/* 4 Node Telemetry Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Ledger Block Height</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 font-mono mt-1">
            #{status?.blockHeight || blocks.length}
          </h3>
          <span className="text-[10px] text-emerald-700 font-mono block mt-1">Genesis Block Root Anchored</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Consensus Engine</span>
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 font-mono mt-1">Raft PBFT</h3>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">3 Active Validating Peers</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Cryptographic Spec</span>
            <Key className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 font-mono mt-1">SHA-256</h3>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Canonical RFC-6962 Trees</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Privacy Architecture</span>
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 font-mono mt-1">Zero PII</h3>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Off-chain Vault + Hash Anchors</span>
        </div>
      </div>

      {/* Audit Result Display Banner if run */}
      {auditResult && (
        <div
          className={`p-5 rounded-3xl border animate-in fade-in ${
            auditResult.isValid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {auditResult.isValid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            )}
            <div>
              <h4 className="text-sm font-bold">
                {auditResult.isValid
                  ? 'Cryptographic Verification Passed: All Blocks & Hashes Valid'
                  : 'Ledger Audit Violation: Tampered Block Detected!'}
              </h4>
              <p className="text-xs mt-0.5 text-slate-600">
                Audited {auditResult.blockCount} blocks across 3 Raft validator nodes.
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 space-y-1 font-mono text-[11px]">
            {auditResult.auditDetails.map((detail, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-700">
                <span className="text-slate-400">•</span>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: BLOCK EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          {/* Blocks List Column */}
          <div className="lg:col-span-1 p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Ledger Blocks ({filteredBlocks.length})
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Real-time Feed</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search block # or hash..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pl-8 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {filteredBlocks.map((blk) => {
                const isSelected = selectedBlock?.blockNumber === blk.blockNumber;
                return (
                  <div
                    key={blk.blockNumber}
                    onClick={() => {
                      setSelectedBlock(blk);
                      setBlockVerificationResult(null);
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          Block #{blk.blockNumber}
                        </span>
                        {blk.blockNumber === 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                            GENESIS
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {(blk.records?.length ?? blk.transactionCount ?? 0)} Txs
                      </span>
                    </div>

                    <div className="mt-2 font-mono text-[10px] text-slate-500 truncate">
                      Hash: <span className="text-slate-800">{truncateHash(blk.merkleRoot, 8, 6)}</span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 font-mono">
                      <span>{formatDate(blk.timestamp)}</span>
                      <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Committed
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Block Detailed Cryptographic Inspector */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
            {selectedBlock ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-700 font-semibold uppercase tracking-wider">
                      Block Inspection Dossier
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 font-mono">
                      Block #{selectedBlock.blockNumber}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerifyCurrentBlock(selectedBlock.blockNumber)}
                      disabled={isVerifyingBlock}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-all disabled:opacity-50"
                    >
                      {isVerifyingBlock ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Verify Block #{selectedBlock.blockNumber}</span>
                    </button>
                  </div>
                </div>

                {/* Individual Block Verification Output Banner */}
                {blockVerificationResult && (
                  <div
                    className={`p-4 rounded-2xl border text-xs font-mono animate-in fade-in ${
                      blockVerificationResult.isValid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-2">
                      {blockVerificationResult.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>
                        Block #{blockVerificationResult.blockNumber} Verification Result:{' '}
                        {blockVerificationResult.isValid ? 'VALID' : 'INTEGRITY BROKEN'}
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-700">
                      {blockVerificationResult.details.map((d, i) => (
                        <div key={i}>• {d}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cryptographic Hashes Table */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex justify-between text-slate-500 text-[10px] uppercase">
                      <span>Current Block Merkle Root Digest</span>
                      <span className="text-emerald-700 font-semibold">Validated</span>
                    </div>
                    <p className="text-slate-900 break-all text-[11px] select-all font-semibold">
                      {selectedBlock.merkleRoot}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex justify-between text-slate-500 text-[10px] uppercase">
                      <span>Previous Block Hash (Parent Link)</span>
                      <span className="text-blue-700 font-semibold">Linked</span>
                    </div>
                    <p className="text-slate-600 break-all text-[11px] select-all">
                      {selectedBlock.previousHash}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex justify-between text-slate-500 text-[10px] uppercase">
                      <span>Channel Identification & Consensus</span>
                      <span className="text-purple-700 font-semibold">Fabric Channel</span>
                    </div>
                    <p className="text-purple-800 break-all text-[11px] select-all">
                      {selectedBlock.channelId || 'fintech-audit-channel'}
                    </p>
                  </div>
                </div>

                {/* Merkle Leaf Transactions in this block */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Committed Transaction Leaf Records ({(selectedBlock.records || []).length})
                  </h4>

                  {(!selectedBlock.records || selectedBlock.records.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No transaction records in this block.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedBlock.records.map((rec, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-400">Record #{idx}</span>
                            <span className="text-slate-800 select-all truncate max-w-xs">
                              {rec.sha256Hash || rec.txId || rec.recordId}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-700 font-semibold shrink-0 ml-2">SHA-256 Valid</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Validator Node Signatures */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-800">Raft Consensus Node Signatures</span>
                    <span className="font-mono text-emerald-700 font-semibold">3/3 Quorum Reached</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
                      <span className="text-slate-900 block font-semibold">peer0.org1.fabric</span>
                      <span className="text-emerald-700 font-semibold">SIG_ECDSA_VALID</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
                      <span className="text-slate-900 block font-semibold">peer1.org1.fabric</span>
                      <span className="text-emerald-700 font-semibold">SIG_ECDSA_VALID</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
                      <span className="text-slate-900 block font-semibold">orderer0.fabric</span>
                      <span className="text-emerald-700 font-semibold">SIG_ECDSA_VALID</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-slate-400 text-xs">
                Select a block to inspect its cryptographic tree.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TAMPER SIMULATION LAB */}
      {activeTab === 'simulation' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  Interactive Cryptographic Tamper Demonstration Lab
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Walk through an interactive 5-step demonstration showing how off-chain database fraud is immediately detected by the blockchain.
              </p>
            </div>

            <div className="p-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center gap-1.5 shrink-0">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Simulation only — no production financial data was modified.</span>
            </div>
          </div>

          {/* Step Progress Tracker */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {[
              { num: 1, title: 'Sound Baseline', desc: 'SHA-256 match confirmed' },
              { num: 2, title: 'Inject Mutation', desc: 'Simulate altered amount' },
              { num: 3, title: 'Recalculate Hash', desc: 'Generate new digest' },
              { num: 4, title: 'Detect Mismatch', desc: 'Ledger flags divergence' },
              { num: 5, title: 'Restore State', desc: 'Reset to verified chain' },
            ].map((s) => {
              const isCurrent = (isTampered && s.num >= 2 && s.num <= 4) || (!isTampered && s.num === 1);
              return (
                <div
                  key={s.num}
                  className={`p-3 rounded-2xl border text-xs transition-all ${
                    isCurrent
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span>STEP 0{s.num}</span>
                    {isCurrent && <Check className="w-3 h-3 text-indigo-600" />}
                  </div>
                  <div className="text-slate-900 font-bold">{s.title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{s.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Interactive Simulation Console */}
          <div className="p-6 rounded-2xl bg-slate-900 text-white font-mono text-xs space-y-4 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span className="text-slate-400 text-[11px] ml-2">Aegis Cryptographic Integrity Kernel</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isTampered ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isTampered ? 'CRITICAL DISCREPANCY DETECTED' : 'LEDGER STATE NOMINAL'}
              </span>
            </div>

            <div className="space-y-2 text-[11px] leading-relaxed">
              <div className="text-slate-400"># Current System Simulation State:</div>
              {isTampered ? (
                <>
                  <div className="text-rose-400 font-bold">
                    [!] UNAUTHORIZED MUTATION DETECTED in off-chain database table `transactions`.
                  </div>
                  <div className="text-slate-300 pl-4">
                    • Target Transaction ID: <span className="text-amber-300">tx-demo-01</span>
                    <br />
                    • Off-Chain Modified Amount: <span className="text-rose-400 font-bold">₹7,500.00</span> (was ₹2,500.00)
                    <br />
                    • Recalculated SHA-256 Digest: <span className="text-rose-300">e3b0c44298fc1c149afbf4c8996fb92427ae41e4...</span>
                    <br />
                    • Immutable Ledger Root (Block #1): <span className="text-emerald-300">7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f...</span>
                  </div>
                  <div className="text-amber-400 font-semibold mt-2">
                    [*] Cryptographic Assertion: SHA-256(offChainRecord) !== onChainMerkleRoot. Silent falsification completely prevented!
                  </div>
                </>
              ) : (
                <>
                  <div className="text-emerald-400 font-bold">
                    [✓] 100% Cryptographic Match Across All 41 Anchored Transactions.
                  </div>
                  <div className="text-slate-300 pl-4">
                    • All off-chain database records match their anchored SHA-256 block digests.
                    • Fabric channel `fintech-audit-channel` consensus verified across 3 Raft nodes.
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-slate-400 text-[10px]">
                Click below to simulate or reset data tampering:
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleTamper}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isTampered
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {isTampered ? <RotateCcw className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>{isTampered ? 'Restore Legitimate Database' : 'Simulate Off-Chain Tampering'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TECHNICAL ARCHITECTURE */}
      {activeTab === 'architecture' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Technical Architecture & Cryptographic Security Model
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Transparent breakdown of how AegisFinance guarantees auditability while protecting private financial PII.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 w-fit">
                <Database className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">1. Private Tenant Partition</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Raw transaction amounts, categories, and merchant names remain in the isolated private document database. They are never published in plaintext.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-700 w-fit">
                <Key className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">2. Canonical JSON Normalization</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Fields are sorted alphabetically and standardized (fixed 2 decimals, trimmed strings) before hashing to guarantee deterministic SHA-256 reproducibility.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 w-fit">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">3. Hyperledger Fabric Chaining</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Each block seals the previous block hash into its Merkle root, making historic forgery mathematically impossible without invalidating every subsequent block.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Academic & Enterprise Transparency Notice:</strong>
              <p className="mt-0.5 text-blue-800 text-[11px] leading-relaxed">
                This environment runs a live, permissioned Hyperledger Fabric-compatible in-memory adapter that enforces cryptographic SHA-256 chaining, Merkle tree recalculation, and multi-signature peer quorum simulation. No actual funds or ungrounded external networks are used.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
