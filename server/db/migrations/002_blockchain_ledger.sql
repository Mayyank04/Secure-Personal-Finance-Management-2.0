-- 002_blockchain_ledger.sql
-- Fabric-Compatible Enterprise Ledger Simulation Persistence Schema

CREATE TABLE IF NOT EXISTS blockchain_blocks (
  block_number INTEGER PRIMARY KEY,
  channel_id VARCHAR(64) NOT NULL,
  previous_hash VARCHAR(128) NOT NULL,
  merkle_root VARCHAR(128) NOT NULL,
  timestamp VARCHAR(64) NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  endorsements_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blockchain_records (
  id VARCHAR(64) PRIMARY KEY,
  block_number INTEGER NOT NULL,
  channel_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  record_id VARCHAR(64) NOT NULL,
  sha256_hash VARCHAR(128) NOT NULL,
  msp_id VARCHAR(64) NOT NULL,
  timestamp VARCHAR(64) NOT NULL,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
  tx_id VARCHAR(128) NOT NULL,
  CONSTRAINT fk_record_block FOREIGN KEY (block_number) REFERENCES blockchain_blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_blockchain_records_record_id ON blockchain_records(record_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_block ON blockchain_records(block_number);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_tx_id ON blockchain_records(tx_id);
