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

  return JSON.stringify(normalized);
}

export function calculateTransactionHash(data: CanonicalTransactionInput): {
  sha256Hash: string;
  canonicalPayload: string;
} {
  const canonicalPayload = createCanonicalTransactionPayload(data);
  const sha256Hash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
  return { sha256Hash, canonicalPayload };
}
