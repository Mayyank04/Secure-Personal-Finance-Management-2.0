/**
 * Canonical Hashing and SHA-256 Digest Generator
 * 
 * Rules for Canonical Financial Representation:
 * 1. Consistent key ordering in canonical JSON
 * 2. Normalized string fields (trimmed, case-standardized for merchant)
 * 3. Amount normalized to fixed 2 decimal places (e.g. 1250.00)
 * 4. Deterministic SHA-256 output across client and server
 */

import crypto from 'crypto';

export interface CanonicalTransactionInput {
  id: string;
  userId: string;
  date: string;
  amount: number | string;
  type: string;
  category: string;
  merchant: string;
}

/**
 * Produces a deterministic canonical object with sorted keys and normalized values
 */
export function createCanonicalTransactionPayload(data: CanonicalTransactionInput): string {
  const normalized = {
    amount: Number(data.amount).toFixed(2),
    category: String(data.category || 'Other').trim(),
    date: String(data.date || '').trim(),
    id: String(data.id || '').trim(),
    merchant: String(data.merchant || '').trim().toLowerCase(),
    type: String(data.type || 'EXPENSE').toUpperCase().trim(),
    userId: String(data.userId || '').trim(),
  };

  // Keys sorted deterministically: amount, category, date, id, merchant, type, userId
  return JSON.stringify(normalized);
}

/**
 * Calculates SHA-256(canonicalPayload)
 */
export function calculateTransactionHash(data: CanonicalTransactionInput): {
  sha256Hash: string;
  canonicalPayload: string;
} {
  const canonicalPayload = createCanonicalTransactionPayload(data);
  const sha256Hash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
  return { sha256Hash, canonicalPayload };
}
