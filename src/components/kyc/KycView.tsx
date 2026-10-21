import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileCheck,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  UserCheck,
  Lock,
  Sparkles,
  Info,
  RefreshCw,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Shield,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api';
import { KycRecord, KycStatus, KycDocumentType } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const KycView: React.FC = () => {
  const { user } = useAuth();
  const [kycData, setKycData] = useState<KycRecord | null>(null);
  const [status, setStatus] = useState<KycStatus>('NOT_STARTED');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('1995-05-12');
  const [address, setAddress] = useState<string>('742 Evergreen Terrace, Sector 4, Bangalore');
  const [country, setCountry] = useState<string>('India');
  const [documentType, setDocumentType] = useState<KycDocumentType>('NATIONAL_ID');
  const [documentNumber, setDocumentNumber] = useState<string>('9842 1092 8491');
  const [documentImageUri, setDocumentImageUri] = useState<string>('');
  const [showMasked, setShowMasked] = useState<boolean>(true);

  // Reviewer simulation controls
  const [reviewerNotes, setReviewerNotes] = useState<string>('Biometric & facial integrity verified against simulated identity registry.');

  const fetchKycStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.getKycStatus();
      setStatus(res.status);
      setKycData(res.kyc);
      if (res.kyc) {
        setFullName(res.kyc.fullName);
        setDateOfBirth(res.kyc.dateOfBirth);
        setAddress(res.kyc.address);
        setCountry(res.kyc.country);
        setDocumentType(res.kyc.documentType);
        setDocumentNumber(res.kyc.documentNumber);
      } else if (user) {
        setFullName(user.name);
      }
    } catch (err: any) {
      console.error('Failed to load KYC:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKycStatus();
  }, [user]);

  const loadSampleDocument = (type: KycDocumentType) => {
    setDocumentType(type);
    if (type === 'PASSPORT') {
      setDocumentNumber('Z7892014');
      setReviewerNotes('Machine Readable Zone (MRZ) checksum verified.');
    } else if (type === 'DRIVING_LICENSE') {
      setDocumentNumber('DL-042011002348');
      setReviewerNotes('Transport Department simulated database verified.');
    } else if (type === 'NATIONAL_ID') {
      setDocumentNumber('5421 9802 1204');
      setReviewerNotes('Simulated UIDAI demographic hash matched.');
    } else {
      setDocumentNumber('VTR-9021849');
      setReviewerNotes('Electoral roll simulated record matched.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Document file size must be less than 5MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setDocumentImageUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !documentNumber.trim()) {
      setMessage({ type: 'error', text: 'Full name and document number are required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);
      const res = await api.submitKyc({
        fullName,
        dateOfBirth,
        address,
        country,
        documentType,
        documentNumber,
        documentImageUri,
        ocrExtractedData: {
          name: fullName,
          dob: dateOfBirth,
          docNumber: documentNumber,
          confidence: 96.5,
        },
      });

      setStatus(res.status);
      setKycData(res.kyc);
      setMessage({ type: 'success', text: 'KYC documents submitted successfully! Status is now UNDER_REVIEW.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit KYC.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewAction = async (decision: 'APPROVE' | 'REJECT') => {
    try {
      setIsReviewing(true);
      setMessage(null);
      const res = await api.reviewKyc({
        decision,
        reviewerNotes,
        rejectionReason: decision === 'REJECT' ? 'Document image unreadable or mismatched name.' : undefined,
      });

      setStatus(res.status);
      setKycData(res.kyc);
      setMessage({
        type: 'success',
        text: decision === 'APPROVE' ? 'KYC successfully approved and verified!' : 'KYC marked as rejected.',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Review action failed.' });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleResetKyc = async () => {
    if (!window.confirm('Reset your KYC identity submission for demo testing?')) return;
    try {
      setIsLoading(true);
      await api.resetKyc();
      setStatus('NOT_STARTED');
      setKycData(null);
      setDocumentNumber('5421 9802 1204');
      setDocumentImageUri('');
      setMessage({ type: 'success', text: 'KYC record reset to NOT_STARTED.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Reset failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'VERIFIED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>KYC LEVEL 2 (VERIFIED)</span>
          </div>
        );
      case 'UNDER_REVIEW':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold shadow-2xs">
            <Clock className="w-4 h-4 text-amber-600 animate-spin" />
            <span>UNDER REVIEW</span>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold shadow-2xs">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>VERIFICATION REJECTED</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs">
            <AlertCircle className="w-4 h-4 text-slate-500" />
            <span>NOT STARTED</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Identity & KYC Verification Portal
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  DEMO WORKFLOW
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Demonstration compliance portal for identity verification with automated OCR extraction and blockchain audit trail
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <button
            onClick={handleResetKyc}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Reset KYC State for Demo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Educational / Non-Government Transparency Alert */}
      <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 space-y-1">
          <div className="font-bold">Educational & Academic Transparency Notice</div>
          <p className="text-indigo-700 leading-relaxed">
            This module represents an authentic <strong>KYC / Identity Verification Simulation Workflow</strong>. In compliance with security principles, no real government databases (Aadhaar/UIDAI, Passport Seva, DigiLocker) are contacted; all verification records are anchored into the Hyperledger Fabric-compatible ledger simulation for full audit integrity.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Verification Form or Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Identity Submission Form</h2>
                <p className="text-xs text-slate-500">Provide legal name, date of birth, and identity documentation</p>
              </div>

              {/* Sample Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400">Sample Presets:</span>
                <button
                  type="button"
                  onClick={() => loadSampleDocument('NATIONAL_ID')}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  National ID
                </button>
                <button
                  type="button"
                  onClick={() => loadSampleDocument('PASSPORT')}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Passport
                </button>
                <button
                  type="button"
                  onClick={() => loadSampleDocument('DRIVING_LICENSE')}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  License
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitKyc} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Document Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as KycDocumentType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs cursor-pointer"
                  >
                    <option value="NATIONAL_ID">National ID / Aadhaar Card (Demo)</option>
                    <option value="PASSPORT">International Passport</option>
                    <option value="DRIVING_LICENSE">Driver's License</option>
                    <option value="VOTER_ID">Voter Identification Card</option>
                  </select>
                </div>

                {/* Document Number */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Document Identifier</label>
                    <button
                      type="button"
                      onClick={() => setShowMasked(!showMasked)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                    >
                      {showMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{showMasked ? 'Show' : 'Mask'}</span>
                    </button>
                  </div>
                  <input
                    type={showMasked ? 'password' : 'text'}
                    required
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="e.g. 5421 9802 1204"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Postal Code"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                />
              </div>

              {/* Document Image Dropzone / Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Document Image or PDF Proof (Simulated OCR Ingress)
                </label>
                <div className="p-5 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl bg-slate-50/50 text-center transition-all cursor-pointer">
                  <input
                    type="file"
                    id="kyc-upload-input"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="kyc-upload-input" className="cursor-pointer block space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      {documentImageUri ? 'Document Attached (Click to Replace)' : 'Click to Upload Document Photo / PDF'}
                    </div>
                    <p className="text-[10px] text-slate-400">PNG, JPG, PDF up to 5MB (Encrypted storage in SQLite)</p>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Lock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>256-bit Encrypted Ledger Anchoring</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit for Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Status & Simulated Reviewer Workbench */}
        <div className="space-y-6">
          {/* Identity Shield Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900">Current KYC Posture</div>
              <ShieldCheck className={`w-5 h-5 ${status === 'VERIFIED' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Identity Tier:</span>
                <span className="font-bold text-slate-800">{status === 'VERIFIED' ? 'Level 2 (Full Access)' : 'Level 1 (Basic)'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Document Number:</span>
                <span className="font-mono font-bold text-slate-800">{kycData?.maskedDocumentNumber || '•••• •••• ••••'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Verification Status:</span>
                <span className={`font-bold ${status === 'VERIFIED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {status}
                </span>
              </div>
              {kycData?.verifiedAt && (
                <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Verified Timestamp:</span>
                  <span className="font-mono text-slate-700">{new Date(kycData.verifiedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Simulated Reviewer Workbench (Interactive Demonstration) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Simulated Compliance Workbench</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Test human-in-the-loop compliance review actions directly from this evaluator panel:
              </p>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Reviewer Assessment Notes</label>
                <textarea
                  rows={2}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleReviewAction('APPROVE')}
                  disabled={isReviewing || status === 'VERIFIED'}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve KYC</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction('REJECT')}
                  disabled={isReviewing || status === 'REJECTED'}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject KYC</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
