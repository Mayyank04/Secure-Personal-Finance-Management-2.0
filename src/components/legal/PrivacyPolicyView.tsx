import React from 'react';
import { ShieldCheck, Lock, ArrowLeft, CheckCircle2, AlertCircle, Database, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const PrivacyPolicyView: React.FC = () => {
  const { setActiveTab } = useAuth();

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('dashboard')}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          title="Return to Dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-slate-500">Effective Date: November 17, 2026 • Document Version: 2.1.0</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Zero-PII On-Chain Guarantee:</span>
          <p className="text-slate-600 mt-0.5 leading-relaxed">
            CipherLedger enforces an architectural separation between private financial data (stored off-chain in encrypted databases) 
            and consensus audit logs (stored as SHA-256 hashes on the simulated Hyperledger Fabric blockchain). No names, account numbers, 
            or sensitive identifiers are ever anchored to the distributed ledger.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 space-y-8 text-xs text-slate-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">1. Information We Collect</h2>
          <p>We collect and process the following categories of information strictly to provide personal financial accounting services:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Account Identity:</strong> Email address, salted and hashed authentication secrets (PBKDF2 with 100,000 iterations), and session identifiers.</li>
            <li><strong>Financial Records:</strong> Transaction descriptions, amounts, timestamps, categories, and account balance values.</li>
            <li><strong>Client-Side Scanned Media:</strong> Scanned receipts processed via optical character recognition (Tesseract.js). OCR inference executes locally in your browser memory; raw images are not transmitted to third-party ad networks.</li>
            <li><strong>Security Telemetry:</strong> Anonymized audit logs including login timestamps, IP addresses, user agent strings, and token verification statuses.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">2. How Data Is Stored & Protected</h2>
          <p>
            CipherLedger implements multi-layered defensive security controls:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-700" />
                Off-Chain Tenant Isolation
              </div>
              <p className="text-[11px] text-slate-500">
                Data records in PostgreSQL/Supabase and SQLite local instances are filtered by tenant ID (<code className="font-mono">where user_id = $1</code>), preventing Insecure Direct Object Reference (IDOR) attacks.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-700" />
                Cryptographic Hashing
              </div>
              <p className="text-[11px] text-slate-500">
                Transaction records generate mathematical hashes anchored into chronological Merkle trees (RFC 6962) without exposing plaintext information.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">3. Third-Party Services & Integrations</h2>
          <p>
            The application interfaces with:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Supabase / PostgreSQL:</strong> Authoritative persistence provider for production user tables, accounts, and transactions.</li>
            <li><strong>Vercel Serverless:</strong> Edge deployment infrastructure executing stateless backend handlers over TLS 1.3 encryption.</li>
            <li><strong>Synthetic Bank Sandbox:</strong> Simulated banking provider providing synthetic demonstration accounts and mock transactions for evaluation.</li>
          </ul>
          <p className="text-slate-500 pt-1">
            We do not sell, rent, monetize, or disclose your financial records to data brokers, advertising networks, or third-party marketing services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">4. User Data Rights & Portability</h2>
          <p>
            Under applicable data protection frameworks (including GDPR, California CCPA, and Indian Digital Personal Data Protection Act):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Right to Access & Export:</strong> You can export your entire financial history, accounts, and transactions as authenticated JSON via the Settings panel at any time.</li>
            <li><strong>Right to Erasure:</strong> You may request complete deletion of your off-chain financial records and user account via the Security settings.</li>
            <li><strong>Session Revocation:</strong> Logging out immediately records the active session token in durable revocation tables, invalidating further API requests.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">5. Updates & Legal Inquiries</h2>
          <p>
            Any modifications to our privacy architecture will be reflected in an incremented policy version and recorded on the application security notice board.
          </p>
        </section>

        <section className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Data Protection Officer: privacy@cipherledger.internal</span>
          <span>Legal Classification: [Pending Final Corporate Legal Certification]</span>
        </section>
      </div>
    </div>
  );
};
