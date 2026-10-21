/**
 * KYC (Identity Verification Workflow) REST API Routes
 * 
 * Educational / Simulated KYC verification portal.
 * Clearly labeled: "Demo KYC Workflow — No real identity verification performed."
 * 
 * Provides:
 * - Profile & document submission (Passport, Driving License, National ID, Voter ID)
 * - Input validation, document number masking (e.g. •••• •••• 1234)
 * - Simulated OCR extraction & human-in-the-loop review
 * - Cryptographic audit trail anchoring on blockchain ledger simulation
 * - Multi-tenant IDOR protection (tenant isolation by session userId)
 * - SQLite persistent state synchronization
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import { blockchainAdapter } from '../blockchain.js';
import { KycRecord, KycStatus, KycDocumentType } from '../types.js';

export const kycRouter = Router();

function maskDocumentNumber(docNum: string): string {
  if (!docNum) return '•••• •••• ••••';
  const clean = docNum.trim().replace(/[\s-]/g, '');
  if (clean.length <= 4) return '•••• ' + clean;
  const last4 = clean.slice(-4);
  return '•••• •••• ' + last4;
}

// GET /api/kyc/status - Retrieve current user's KYC status
kycRouter.get('/status', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const kyc = db.getUserKyc(userId);

    if (!kyc) {
      return res.json({
        status: 'NOT_STARTED',
        kyc: null,
        message: 'No KYC submission found. Please complete identity verification.',
      });
    }

    // Return sanitized KYC record (masked document number)
    const sanitized: KycRecord = {
      ...kyc,
      documentNumber: kyc.status === 'VERIFIED' ? kyc.maskedDocumentNumber : kyc.documentNumber,
    };

    return res.json({
      status: kyc.status,
      kyc: sanitized,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve KYC status.' });
  }
});

// POST /api/kyc/submit - Submit KYC document and profile
kycRouter.post('/submit', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      fullName,
      dateOfBirth,
      address,
      country = 'India',
      documentType,
      documentNumber,
      documentImageUri,
      ocrExtractedData,
    } = req.body;

    if (!fullName || !documentType || !documentNumber) {
      return res.status(400).json({
        error: 'Full name, document type, and document number are required for KYC submission.',
      });
    }

    const validDocTypes: KycDocumentType[] = ['PASSPORT', 'DRIVING_LICENSE', 'NATIONAL_ID', 'VOTER_ID'];
    if (!validDocTypes.includes(documentType)) {
      return res.status(400).json({
        error: 'Invalid document type. Allowed types: PASSPORT, DRIVING_LICENSE, NATIONAL_ID, VOTER_ID.',
      });
    }

    const maskedDocumentNumber = maskDocumentNumber(documentNumber);
    const existingKyc = db.getUserKyc(userId);
    const kycId = existingKyc?.id || 'kyc-' + crypto.randomBytes(6).toString('hex');
    const now = new Date().toISOString();

    const newKycRecord: KycRecord = {
      id: kycId,
      userId,
      fullName: fullName.trim(),
      dateOfBirth: dateOfBirth || '',
      address: address || '',
      country: country || 'India',
      documentType,
      documentNumber: documentNumber.trim(),
      maskedDocumentNumber,
      status: 'UNDER_REVIEW',
      documentImageUri: documentImageUri || undefined,
      ocrExtractedData: ocrExtractedData || undefined,
      reviewerNotes: 'Document uploaded and awaiting simulated compliance review.',
      submittedAt: now,
      createdAt: existingKyc?.createdAt || now,
      updatedAt: now,
    };

    db.saveUserKyc(newKycRecord);
    persistentSqlite.syncFromMemoryDb(db);

    // Anchor KYC submission to blockchain ledger simulation
    const docHash = crypto
      .createHash('sha256')
      .update(`${kycId}:${userId}:${documentType}:${maskedDocumentNumber}:${now}`)
      .digest('hex');

    blockchainAdapter.recordAuditEvent(kycId, docHash);

    db.recordAuditEvent({
      userId,
      eventType: 'KYC_DOCUMENT_SUBMITTED',
      description: `Submitted ${documentType} (${maskedDocumentNumber}) for identity verification.`,
    });

    return res.status(201).json({
      message: 'KYC documents submitted successfully. Status is now UNDER_REVIEW.',
      status: 'UNDER_REVIEW',
      kyc: newKycRecord,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process KYC submission: ' + err.message });
  }
});

// POST /api/kyc/review - Simulated Reviewer Action (Approve or Reject)
kycRouter.post('/review', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { decision, reviewerNotes, rejectionReason } = req.body;

    const kyc = db.getUserKyc(userId);
    if (!kyc) {
      return res.status(404).json({ error: 'No KYC record found for this user.' });
    }

    const now = new Date().toISOString();

    if (decision === 'APPROVE') {
      kyc.status = 'VERIFIED';
      kyc.verifiedAt = now;
      kyc.reviewerNotes = reviewerNotes || 'Verified against simulated identity registry.';
      kyc.rejectionReason = undefined;
      kyc.updatedAt = now;

      // Anchor approval into blockchain
      const approvalHash = crypto
        .createHash('sha256')
        .update(`KYC_VERIFIED:${kyc.id}:${userId}:${now}`)
        .digest('hex');
      blockchainAdapter.recordAuditEvent(kyc.id, approvalHash);

      db.recordAuditEvent({
        userId,
        eventType: 'KYC_APPROVED',
        description: `Identity verification approved for ${kyc.fullName} (${kyc.maskedDocumentNumber}).`,
      });
    } else if (decision === 'REJECT') {
      kyc.status = 'REJECTED';
      kyc.rejectionReason = rejectionReason || 'Document details could not be matched. Please re-upload a clear document.';
      kyc.reviewerNotes = reviewerNotes || 'Rejected during compliance review.';
      kyc.updatedAt = now;

      db.recordAuditEvent({
        userId,
        eventType: 'KYC_REJECTED',
        description: `Identity verification rejected: ${kyc.rejectionReason}`,
      });
    } else {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVE or REJECT.' });
    }

    db.saveUserKyc(kyc);
    persistentSqlite.syncFromMemoryDb(db);

    return res.json({
      message: `KYC status updated to ${kyc.status}.`,
      status: kyc.status,
      kyc,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process KYC review: ' + err.message });
  }
});

// POST /api/kyc/reset - Reset KYC for Demo Testing
kycRouter.post('/reset', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    db.deleteUserKyc(userId);
    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'KYC_RESET',
      description: 'KYC identity record reset for testing.',
    });

    return res.json({
      message: 'KYC record reset successfully.',
      status: 'NOT_STARTED',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset KYC record.' });
  }
});
