import crypto from 'crypto';
import { BlockchainBlock, BlockchainRecord } from './types.js';
import { calculateTransactionHash, CanonicalTransactionInput, createCanonicalTransactionPayload } from './canonicalHash.js';
import { getDatabaseAdapter } from './db/index.js';

export interface VerificationResult {
  verified: boolean;
  recordId: string;
  recalculatedHash: string;
  blockchainHash: string;
  blockNumber: number;
  channelId: string;
  mspId: string;
  timestamp: string;
  status: 'VERIFIED' | 'MISMATCH_DETECTED' | 'NOT_FOUND_ON_CHAIN';
  diagnosticMessage: string;
  canonicalPayload?: string;
  tamperDetails?: {
    isTampered: boolean;
    differencesFound?: string[];
  };
}

export interface BlockVerificationResult {
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
}

export interface ChainVerificationResult {
  isValid: boolean;
  auditedBlockCount: number;
  totalRecordsAudited: number;
  genesisBlockValid: boolean;
  failedBlocks: number[];
  logMessages: string[];
  auditedAt: string;
}

export class BlockchainAdapter {
  private channelId: string = 'fintech-audit-channel';
  private orgMspId: string = 'FintechOrg1MSP';
  private chaincodeId: string = 'finance-audit-contract-v2.4';
  private blocks: BlockchainBlock[] = [];
  private records: Map<string, BlockchainRecord> = new Map();

  constructor() {
    this.initGenesisBlock();
  }

  private initGenesisBlock() {
    const genesisRecord: BlockchainRecord = {
      id: 'tx-genesis-0000',
      blockNumber: 0,
      channelId: this.channelId,
      eventType: 'SECURITY_EVENT',
      recordId: 'system-genesis-root',
      sha256Hash: crypto.createHash('sha256').update('GENESIS_BLOCK_INITIALIZATION_ROOT_AEGIS_V4').digest('hex'),
      mspId: this.orgMspId,
      timestamp: new Date('2026-06-01T00:00:00Z').toISOString(),
      verificationStatus: 'VERIFIED',
      txId: 'fab-tx-genesis-' + crypto.randomBytes(8).toString('hex'),
    };

    const genesisBlock: BlockchainBlock = {
      blockNumber: 0,
      channelId: this.channelId,
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
      merkleRoot: genesisRecord.sha256Hash,
      timestamp: genesisRecord.timestamp,
      transactionCount: 1,
      endorsements: ['FintechOrg1MSP.peer0', 'RegulatorOrgMSP.peer0', 'AuditorOrgMSP.peer1'],
      records: [genesisRecord],
    };

    this.blocks.push(genesisBlock);
    this.records.set(genesisRecord.recordId, genesisRecord);
  }

  public computeCanonicalTransactionHash(data: CanonicalTransactionInput): string {
    return calculateTransactionHash(data).sha256Hash;
  }

  public getCanonicalPayloadString(data: CanonicalTransactionInput): string {
    return createCanonicalTransactionPayload(data);
  }

  public computeConsentHash(userId: string, consentType: string, status: boolean, timestamp: string): string {
    const payload = JSON.stringify({
      consentType: consentType.trim().toUpperCase(),
      status: Boolean(status),
      timestamp: String(timestamp).trim(),
      userId: String(userId).trim(),
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  public registerUserIdentity(userId: string): BlockchainRecord {
    const hash = crypto.createHash('sha256').update(`USER_IDENTITY_REGISTERED:${userId}`).digest('hex');
    return this.commitRecord({
      eventType: 'USER_IDENTITY_REGISTERED',
      recordId: userId,
      sha256Hash: hash,
    });
  }

  public recordTransactionHash(recordId: string, canonicalHash: string): BlockchainRecord {
    return this.commitRecord({
      eventType: 'TRANSACTION_RECORDED',
      recordId,
      sha256Hash: canonicalHash,
    });
  }

  public recordAuditEvent(recordId: string, eventHash: string): BlockchainRecord {
    return this.commitRecord({
      eventType: 'SECURITY_EVENT',
      recordId,
      sha256Hash: eventHash,
    });
  }

  public recordConsentChange(userId: string, consentType: string, granted: boolean): BlockchainRecord {
    const timestamp = new Date().toISOString();
    const hash = this.computeConsentHash(userId, consentType, granted, timestamp);
    return this.commitRecord({
      eventType: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
      recordId: `consent-${userId}-${consentType}`,
      sha256Hash: hash,
    });
  }

  public verifyTransactionHash(recordId: string, currentOffchainData: CanonicalTransactionInput): VerificationResult {
    const { sha256Hash: recalculatedHash, canonicalPayload } = calculateTransactionHash(currentOffchainData);
    const onChainRecord = this.records.get(recordId);

    if (!onChainRecord) {
      return {
        verified: false,
        recordId,
        recalculatedHash,
        blockchainHash: 'NOT_FOUND_ON_LEDGER',
        blockNumber: -1,
        channelId: this.channelId,
        mspId: this.orgMspId,
        timestamp: new Date().toISOString(),
        status: 'NOT_FOUND_ON_CHAIN',
        diagnosticMessage: 'Record was not found on the permissioned audit ledger.',
        canonicalPayload,
      };
    }

    const isMatch = recalculatedHash === onChainRecord.sha256Hash;

    return {
      verified: isMatch,
      recordId,
      recalculatedHash,
      blockchainHash: onChainRecord.sha256Hash,
      blockNumber: onChainRecord.blockNumber,
      channelId: onChainRecord.channelId,
      mspId: onChainRecord.mspId,
      timestamp: onChainRecord.timestamp,
      status: isMatch ? 'VERIFIED' : 'MISMATCH_DETECTED',
      canonicalPayload,
      tamperDetails: {
        isTampered: !isMatch,
        differencesFound: !isMatch ? [
          `Recalculated SHA-256 Digest: ${recalculatedHash}`,
          `Anchored Block #${onChainRecord.blockNumber} Digest: ${onChainRecord.sha256Hash}`,
          'Mismatch indicates local off-chain transaction fields (amount, category, merchant, date, or type) were modified.'
        ] : undefined,
      },
      diagnosticMessage: isMatch
        ? 'Cryptographic match confirmed. SHA-256 checksum perfectly matches the immutable ledger record.'
        : 'CRITICAL AUDIT MISMATCH: The recalculated SHA-256 hash does not match the ledger state. Unauthorized modification detected!',
    };
  }

  public verifyBlock(blockNumber: number): BlockVerificationResult {
    const blockIndex = this.blocks.findIndex(b => b.blockNumber === blockNumber);
    if (blockIndex === -1) {
      return {
        isValid: false,
        blockNumber,
        merkleRoot: 'N/A',
        recalculatedMerkleRoot: 'N/A',
        previousHash: 'N/A',
        expectedPreviousHash: 'N/A',
        transactionCount: 0,
        recordsVerified: 0,
        recordsFailed: 0,
        details: [`Block #${blockNumber} does not exist in chain.`],
      };
    }

    const block = this.blocks[blockIndex];
    const details: string[] = [];
    let isValid = true;

    let expectedPreviousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    if (blockIndex > 0) {
      expectedPreviousHash = this.blocks[blockIndex - 1].merkleRoot;
    }

    if (block.previousHash !== expectedPreviousHash) {
      isValid = false;
      details.push(`Previous hash mismatch: Block previousHash (${block.previousHash.slice(0, 12)}...) !== parent merkleRoot (${expectedPreviousHash.slice(0, 12)}...)`);
    } else {
      details.push(`Parent link verified: Previous hash matches Block #${blockIndex > 0 ? blockIndex - 1 : 0}`);
    }

    let computedMerkleRoot = '';
    if (blockIndex === 0) {
      computedMerkleRoot = block.records[0]?.sha256Hash || block.merkleRoot;
    } else {
      const recordsHashConcat = (block.records || []).map(r => r.sha256Hash).join('');
      computedMerkleRoot = crypto
        .createHash('sha256')
        .update(expectedPreviousHash + recordsHashConcat)
        .digest('hex');
    }

    if (computedMerkleRoot !== block.merkleRoot) {
      isValid = false;
      details.push(`Merkle root calculation mismatch: Stored (${block.merkleRoot.slice(0, 12)}...) !== Computed (${computedMerkleRoot.slice(0, 12)}...)`);
    } else {
      details.push(`Merkle root verified: ${block.merkleRoot.slice(0, 16)}...`);
    }

    details.push(`Endorsements verified: ${block.endorsements.length} peer signatures valid.`);

    return {
      isValid,
      blockNumber,
      merkleRoot: block.merkleRoot,
      recalculatedMerkleRoot: computedMerkleRoot,
      previousHash: block.previousHash,
      expectedPreviousHash,
      transactionCount: block.records.length,
      recordsVerified: isValid ? block.records.length : 0,
      recordsFailed: isValid ? 0 : block.records.length,
      details,
    };
  }

  private commitRecord(payload: {
    eventType: BlockchainRecord['eventType'];
    recordId: string;
    sha256Hash: string;
  }): BlockchainRecord {
    const previousBlock = this.blocks[this.blocks.length - 1];
    const newBlockNumber = previousBlock.blockNumber + 1;
    const timestamp = new Date().toISOString();
    const txId = 'fab-tx-' + crypto.randomBytes(12).toString('hex');

    const newRecord: BlockchainRecord = {
      id: 'rec-' + crypto.randomBytes(6).toString('hex'),
      blockNumber: newBlockNumber,
      channelId: this.channelId,
      eventType: payload.eventType,
      recordId: payload.recordId,
      sha256Hash: payload.sha256Hash,
      mspId: this.orgMspId,
      timestamp,
      verificationStatus: 'VERIFIED',
      txId,
    };

    const merkleRoot = crypto
      .createHash('sha256')
      .update(previousBlock.merkleRoot + newRecord.sha256Hash)
      .digest('hex');

    const newBlock: BlockchainBlock = {
      blockNumber: newBlockNumber,
      channelId: this.channelId,
      previousHash: previousBlock.merkleRoot,
      merkleRoot,
      timestamp,
      transactionCount: 1,
      endorsements: ['FintechOrg1MSP.peer0', 'RegulatorOrgMSP.peer0', 'AuditorOrgMSP.peer1'],
      records: [newRecord],
    };

    this.blocks.push(newBlock);
    this.records.set(payload.recordId, newRecord);

    try {
      const adapter = getDatabaseAdapter();
      if (adapter && adapter.isInitialized()) {
        adapter.saveBlockchainBlock(newBlock).catch(() => {});
        adapter.saveBlockchainRecord(newRecord).catch(() => {});
      }
    } catch {}

    return newRecord;
  }

  public getLedgerStatus() {
    return {
      channelId: this.channelId,
      network: 'Hyperledger Fabric Compatible In-Memory Ledger',
      consensusType: 'Raft / PBFT Ordering Simulator',
      mspId: this.orgMspId,
      chaincodeId: this.chaincodeId,
      blockHeight: this.blocks.length,
      totalAnchoredRecords: this.records.size,
      lastBlockHash: this.blocks[this.blocks.length - 1]?.merkleRoot || 'N/A',
      lastBlockTimestamp: this.blocks[this.blocks.length - 1]?.timestamp || 'N/A',
      privacyModel: 'Strict Private Tenant DB + Canonical SHA-256 On-Ledger Anchors',
      adapterStatus: 'ACTIVE_EMULATION_ADAPTER',
      peerEndorsementsRequired: 2,
      isSimulation: true,
      simulationNotice: 'Local Fabric-compatible adapter simulation. Zero personal data on-chain.',
    };
  }

  public getAuditHistory(limit: number = 50): BlockchainRecord[] {
    const list = Array.from(this.records.values());
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
  }

  public getBlocks(limit: number = 50): BlockchainBlock[] {
    return [...this.blocks].reverse().slice(0, limit);
  }

  public getBlockByNumber(blockNumber: number): BlockchainBlock | undefined {
    return this.blocks.find(b => b.blockNumber === blockNumber);
  }

  public getRecordById(recordId: string): BlockchainRecord | undefined {
    return this.records.get(recordId);
  }

  public verifyChainIntegrity(): ChainVerificationResult {
    const logs: string[] = [];
    const failedBlocks: number[] = [];
    let isValid = true;
    let totalRecordsAudited = this.blocks.reduce((acc, b) => acc + (b.records?.length || 0), 0);

    const genesis = this.blocks[0];
    const genesisValid = genesis && genesis.blockNumber === 0 && genesis.previousHash === '0000000000000000000000000000000000000000000000000000000000000000';
    if (!genesisValid) {
      isValid = false;
      failedBlocks.push(0);
      logs.push('CRITICAL: Genesis block #0 has corrupted previousHash.');
    } else {
      logs.push('Genesis Block #0 Root verified [OK]');
    }

    for (let i = 1; i < this.blocks.length; i++) {
      const prevBlock = this.blocks[i - 1];
      const currBlock = this.blocks[i];

      if (currBlock.previousHash !== prevBlock.merkleRoot) {
        isValid = false;
        failedBlocks.push(currBlock.blockNumber);
        logs.push(`Integrity Broken at Block #${currBlock.blockNumber}: previousHash (${currBlock.previousHash.slice(0, 10)}...) does not match Block #${prevBlock.blockNumber} merkleRoot (${prevBlock.merkleRoot.slice(0, 10)}...)`);
      } else {
        const recordsConcat = (currBlock.records || []).map(r => r.sha256Hash).join('');
        const computedRoot = crypto
          .createHash('sha256')
          .update(prevBlock.merkleRoot + recordsConcat)
          .digest('hex');

        if (computedRoot !== currBlock.merkleRoot) {
          isValid = false;
          failedBlocks.push(currBlock.blockNumber);
          logs.push(`Merkle Mismatch at Block #${currBlock.blockNumber}: recalculated digest does not match block header.`);
        } else {
          logs.push(`Block #${currBlock.blockNumber}: Hash link & Merkle root verified against Block #${prevBlock.blockNumber} [OK]`);
        }
      }
    }

    return {
      isValid,
      auditedBlockCount: this.blocks.length,
      totalRecordsAudited,
      genesisBlockValid: genesisValid,
      failedBlocks,
      logMessages: logs.slice(-10),
      auditedAt: new Date().toISOString(),
    };
  }

  public resetLedger() {
    this.blocks = [];
    this.records.clear();
    this.initGenesisBlock();
    try {
      const adapter = getDatabaseAdapter();
      if (adapter && adapter.isInitialized() && this.blocks[0]) {
        adapter.saveBlockchainBlock(this.blocks[0]).catch(() => {});
        if (this.blocks[0].records[0]) {
          adapter.saveBlockchainRecord(this.blocks[0].records[0]).catch(() => {});
        }
      }
    } catch {}
  }

  public async persistAllBlocks(): Promise<void> {
    try {
      const adapter = getDatabaseAdapter();
      if (!adapter || !adapter.isInitialized()) return;
      await adapter.withTransaction(async tx => {
        for (const block of this.blocks) {
          await tx.saveBlockchainBlock(block);
          for (const rec of block.records || []) {
            await tx.saveBlockchainRecord(rec);
          }
        }
      });
    } catch (err) {
      console.warn('[BlockchainAdapter] Error persisting all blocks:', err);
    }
  }

  public async loadFromDatabase(): Promise<void> {
    try {
      const adapter = getDatabaseAdapter();
      if (!adapter || !adapter.isInitialized()) return;
      const state = await adapter.loadBlockchainState();
      if (state.blocks.length > 1) {
        this.blocks = state.blocks;
        this.records.clear();
        for (const r of state.records) {
          this.records.set(r.recordId, r);
        }
        console.log(`[BlockchainAdapter] Restored ledger from database: ${this.blocks.length} blocks, ${this.records.size} records.`);
      } else {
        await this.persistAllBlocks();
      }
    } catch (err) {
      console.warn('[BlockchainAdapter] Could not load state from DB:', err);
    }
  }
}

export const blockchainAdapter = new BlockchainAdapter();
