/**
 * KYC (Identity Verification Workflow) REST API Routes
 * 
 * Educational / Simulated KYC verification portal.
 * Clearly labeled: "Demo KYC Workflow — No real identity verification performed."
 * 
 * Provides:
 * - Profile & document submission (Passport, Driving License, National ID, Voter ID)
 * - Input validation, document number masking (e.g. •••• •••• 1234)
 * - User update of permitted non-privileged profile fields (PATCH /api/kyc)
 * - Strict prohibition on self-approval of verification statuses
 * - Administrative reviewer verification action (POST /api/kyc/review)
 * - Cryptographic audit trail anchoring on blockchain ledger simulation
 * - Multi-tenant IDOR protection and direct database persistence
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { blockchainAdapter } from '../blockchain.js';
import { sendSuccess, sendError, isValidIsoDate } from '../apiResponse.js';
import { KycRecord, KycStatus, KycDocumentType } from '../types.js';

export const kycRouter = Router();

function maskDocumentNumber(docNum: string): string {
  if (!docNum) return '•••• •••• ••••';
  const clean = docNum.trim().replace(/[\s-]/g, '');
  if (clean.length <= 4) return '•••• ' + clean;
  const last4 = clean.slice(-4);
  return '•••• •••• ' + last4;
}

// GET /api/kyc/status - Retrieve current user's KYC status summary
kycRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let kyc = await adapter.getKycRecordForUser(userId);
    if (!kyc) {
      kyc = db.getUserKyc(userId) || null;
    }

    if (!kyc) {
      return sendSuccess(res, 200, {
        status: 'NOT_STARTED',
        kyc: null,
      }, 'No KYC submission found. Please complete identity verification.');
    }

    const sanitized: KycRecord = {
      ...kyc,
      documentNumber: kyc.status === 'VERIFIED' ? kyc.maskedDocumentNumber : kyc.documentNumber,
    };

    return sendSuccess(res, 200, {
      status: kyc.status,
      kyc: sanitized,
    });
  } catch (err: any) {
    return sendError(res, 500, 'KYC_STATUS_ERROR', 'Failed to retrieve KYC status: ' + err.message);
  }
});

// GET /api/kyc - Retrieve complete sanitized KYC record for user
kycRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let kyc = await adapter.getKycRecordForUser(userId);
    if (!kyc) {
      kyc = db.getUserKyc(userId) || null;
    }

    if (!kyc) {
      return sendError(res, 404, 'KYC_NOT_FOUND', 'No KYC record exists for this user account.');
    }

    const sanitized: KycRecord = {
      ...kyc,
      documentNumber: kyc.status === 'VERIFIED' ? kyc.maskedDocumentNumber : kyc.documentNumber,
    };

    return sendSuccess(res, 200, { kyc: sanitized });
  } catch (err: any) {
    return sendError(res, 500, 'KYC_FETCH_ERROR', 'Failed to retrieve KYC record: ' + err.message);
  }
});

// POST /api/kyc/submit - Submit KYC document and profile
kycRouter.post('/submit', async (req: Request, res: Response) => {
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

    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Full legal name is required for KYC submission.');
    }
    if (!documentType || typeof documentType !== 'string') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Document type is required.');
    }
    if (!documentNumber || typeof documentNumber !== 'string' || documentNumber.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Document number is required.');
    }

    const validDocTypes: KycDocumentType[] = ['PASSPORT', 'DRIVING_LICENSE', 'NATIONAL_ID', 'VOTER_ID', 'PAN', 'AADHAAR'];
    if (!validDocTypes.includes(documentType as KycDocumentType)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid document type. Allowed types: PASSPORT, DRIVING_LICENSE, NATIONAL_ID, VOTER_ID, PAN, AADHAAR.');
    }

    const adapter = getDatabaseAdapter();
    const existingKyc = await adapter.getKycRecordForUser(userId);

    const maskedDocumentNumber = maskDocumentNumber(documentNumber);
    const kycId = existingKyc?.id || 'kyc-' + crypto.randomBytes(6).toString('hex');
    const now = new Date().toISOString();

    const newKycRecord: KycRecord = {
      id: kycId,
      userId,
      fullName: fullName.trim(),
      dateOfBirth: dateOfBirth || '',
      address: address || '',
      country: country || 'India',
      documentType: documentType as KycDocumentType,
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

    // Direct database persistence
    await adapter.saveKycRecord(newKycRecord);

    // Keep memory cache updated
    db.saveUserKyc(newKycRecord);

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

    return sendSuccess(res, 201, {
      status: 'UNDER_REVIEW',
      kyc: newKycRecord,
    }, 'KYC documents submitted successfully. Status is now UNDER_REVIEW.');
  } catch (err: any) {
    return sendError(res, 500, 'KYC_SUBMIT_ERROR', 'Failed to process KYC submission: ' + err.message);
  }
});

// PATCH /api/kyc - Update permitted user profile fields (prevents self-approval)
kycRouter.patch('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let kyc = await adapter.getKycRecordForUser(userId);
    if (!kyc) {
      kyc = db.getUserKyc(userId) || null;
    }

    if (!kyc) {
      return sendError(res, 404, 'KYC_NOT_FOUND', 'No KYC record found to update.');
    }

    // Security Guard: Prevent standard users from modifying privileged status fields
    const { status, verifiedAt, reviewerNotes, rejectionReason, fullName, dateOfBirth, address, country, documentImageUri } = req.body;

    if (status !== undefined || verifiedAt !== undefined || reviewerNotes !== undefined || rejectionReason !== undefined) {
      return sendError(
        res,
        403,
        'FORBIDDEN_PRIVILEGED_MODIFICATION',
        'Forbidden: Verification status and review remarks cannot be altered directly by users.'
      );
    }

    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Full name cannot be empty.');
      }
      kyc.fullName = fullName.trim();
    }

    if (dateOfBirth !== undefined) kyc.dateOfBirth = String(dateOfBirth);
    if (address !== undefined) kyc.address = String(address);
    if (country !== undefined) kyc.country = String(country);
    if (documentImageUri !== undefined) kyc.documentImageUri = String(documentImageUri);

    kyc.updatedAt = new Date().toISOString();

    await adapter.saveKycRecord(kyc);
    db.saveUserKyc(kyc);

    db.recordAuditEvent({
      userId,
      eventType: 'KYC_PROFILE_UPDATED',
      description: 'Updated user details in KYC profile record.',
    });

    return sendSuccess(res, 200, { kyc }, 'KYC profile updated successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'KYC_UPDATE_ERROR', 'Failed to update KYC profile: ' + err.message);
  }
});

// POST /api/kyc/review - Privileged Reviewer Action (Approve or Reject)
// Protected: Only users with role === 'ADMIN' or reviewers may approve/reject KYC records
kycRouter.post('/review', async (req: Request, res: Response) => {
  try {
    const requesterId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    const requesterUser = await adapter.getUserById(requesterId);
    const targetUserId = req.body.targetUserId || requesterId;

    // Security Check: Normal users cannot approve their own verification
    if (requesterUser?.role !== 'ADMIN') {
      return sendError(
        res,
        403,
        'FORBIDDEN_PRIVILEGED_ACTION',
        'Forbidden: Only authorized compliance officers or administrators can approve or reject KYC verifications.'
      );
    }

    const { decision, reviewerNotes, rejectionReason } = req.body;
    let kyc = await adapter.getKycRecordForUser(targetUserId);
    if (!kyc) {
      kyc = db.getUserKyc(targetUserId) || null;
    }

    if (!kyc) {
      return sendError(res, 404, 'KYC_NOT_FOUND', 'No KYC record found for this user.');
    }

    const now = new Date().toISOString();

    if (decision === 'APPROVE') {
      kyc.status = 'VERIFIED';
      kyc.verifiedAt = now;
      kyc.reviewerNotes = reviewerNotes || 'Verified against compliance identity registry.';
      kyc.rejectionReason = undefined;
      kyc.updatedAt = now;

      // Anchor approval into blockchain
      const approvalHash = crypto
        .createHash('sha256')
        .update(`KYC_VERIFIED:${kyc.id}:${targetUserId}:${now}`)
        .digest('hex');
      blockchainAdapter.recordAuditEvent(kyc.id, approvalHash);

      db.recordAuditEvent({
        userId: targetUserId,
        eventType: 'KYC_APPROVED',
        description: `Identity verification approved for ${kyc.fullName} (${kyc.maskedDocumentNumber}) by administrator ${requesterUser.email}.`,
      });
    } else if (decision === 'REJECT') {
      kyc.status = 'REJECTED';
      kyc.rejectionReason = rejectionReason || 'Document details could not be matched. Please re-upload a clear document.';
      kyc.reviewerNotes = reviewerNotes || 'Rejected during compliance review.';
      kyc.updatedAt = now;

      db.recordAuditEvent({
        userId: targetUserId,
        eventType: 'KYC_REJECTED',
        description: `Identity verification rejected: ${kyc.rejectionReason}`,
      });
    } else {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid decision. Must be APPROVE or REJECT.');
    }

    await adapter.saveKycRecord(kyc);
    db.saveUserKyc(kyc);

    return sendSuccess(res, 200, {
      status: kyc.status,
      kyc,
    }, `KYC status updated to ${kyc.status}.`);
  } catch (err: any) {
    return sendError(res, 500, 'KYC_REVIEW_ERROR', 'Failed to process KYC review: ' + err.message);
  }
});

// POST /api/kyc/reset - Reset KYC for Demo Testing
kycRouter.post('/reset', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    await adapter.execute(`DELETE FROM kyc_records WHERE user_id = $1;`, [userId]);
    db.deleteUserKyc(userId);

    db.recordAuditEvent({
      userId,
      eventType: 'KYC_RESET',
      description: 'KYC identity record reset for testing.',
    });

    return sendSuccess(res, 200, { status: 'NOT_STARTED' }, 'KYC record reset successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'KYC_RESET_ERROR', 'Failed to reset KYC record: ' + err.message);
  }
});
