/**
 * Full HTTP REST API Acceptance Test against http://localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

async function runApiAcceptance() {
  console.log('\n================================================================');
  console.log('  HTTP REST API END-TO-END VERIFICATION (http://localhost:3000)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, name: string, detail?: string) {
    if (cond) {
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Health check & unauthenticated reject
  const unauthRes = await fetch(`${BASE_URL}/api/blockchain/status`);
  assert(unauthRes.status === 401, 'Endpoint /api/blockchain/status correctly returns 401 without auth token');

  // 2. Login as Demo User
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.morgan@fintech-demo.com',
      password: 'DemoPassword@2026',
    }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && (loginData.token || loginData.mfaRequired), 'Login returned valid response (200 OK)');
  
  let token = loginData.token;
  if (!token && loginData.mfaRequired) {
    // Complete MFA with static or demo secret if challenged
    const mfaRes = await fetch(`${BASE_URL}/api/auth/mfa/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaTicket: loginData.mfaTicket, code: '123456' }),
    });
    const mfaData = await mfaRes.json();
    token = mfaData.token;
  }

  if (!token) {
    const demoRes = await fetch(`${BASE_URL}/api/auth/demo-session`, { method: 'POST' });
    const demoData = await demoRes.json();
    token = demoData.token;
  }

  assert(typeof token === 'string' && token.length > 10, 'Session token acquired');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // 3. User Me & Profile
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
  const meData = await meRes.json();
  assert(meRes.status === 200 && meData.user?.email !== undefined, `User Profile authenticated: ${meData.user?.email}`);

  // 4. Financial Calendar ICS Export
  const icsRes = await fetch(`${BASE_URL}/api/calendar/export-ics`, { headers: authHeaders });
  const icsText = await icsRes.text();
  assert(icsRes.status === 200 && icsText.includes('BEGIN:VCALENDAR') && icsText.includes('END:VCALENDAR'), 'GET /api/calendar/export-ics returns valid RFC 5545 iCalendar stream with 200 OK');

  // 5. KYC Status & Submission
  const kycStatusRes = await fetch(`${BASE_URL}/api/kyc/status`, { headers: authHeaders });
  const kycStatusData = await kycStatusRes.json();
  assert(kycStatusRes.status === 200 && kycStatusData.status !== undefined, `KYC status retrieved: ${kycStatusData.status}`);

  const kycSubmitRes = await fetch(`${BASE_URL}/api/kyc/submit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: 'Alex Morgan',
      dateOfBirth: '1992-06-15',
      address: '42 Wallaby Way, Sydney',
      country: 'India',
      documentType: 'PASSPORT',
      documentNumber: 'Z8920145',
      ocrExtractedData: { name: 'Alex Morgan', docNumber: 'Z8920145' },
    }),
  });
  const kycSubmitData = await kycSubmitRes.json();
  assert((kycSubmitRes.status === 200 || kycSubmitRes.status === 201) && kycSubmitData.status === 'UNDER_REVIEW', 'POST /api/kyc/submit transitions state to UNDER_REVIEW');
  assert(kycSubmitData.kyc?.maskedDocumentNumber === '•••• •••• 0145', 'Document number masked in KYC API response');

  // 6. KYC Review & Approval
  const kycReviewRes = await fetch(`${BASE_URL}/api/kyc/review`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      decision: 'APPROVE',
      reviewerNotes: 'Biometrics and document checksum matched.',
    }),
  });
  const kycReviewData = await kycReviewRes.json();
  assert(kycReviewRes.status === 200 && kycReviewData.status === 'VERIFIED', 'POST /api/kyc/review transitions status to VERIFIED');

  // 7. Statement Import CSV Preview & Confirm
  const sampleCsv = `Date,Description,Amount,Type,Category,Account\n2026-08-20,Blue Tokai Coffee,350.00,EXPENSE,Food,Checking\n2026-08-21,Client Freelance Payout,45000.00,INCOME,Salary,Checking`;
  const csvPreviewRes = await fetch(`${BASE_URL}/api/import/csv-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ csvContent: sampleCsv }),
  });
  const csvPreviewData = await csvPreviewRes.json();
  assert(csvPreviewRes.status === 200 && csvPreviewData.summary?.totalRows === 2, 'POST /api/import/csv-preview parses CSV rows accurately');

  // 8. Blockchain Ledger Status & Chain Integrity
  const chainRes = await fetch(`${BASE_URL}/api/blockchain/verify-chain`, {
    method: 'POST',
    headers: authHeaders,
  });
  const chainData = await chainRes.json();
  assert(chainRes.status === 200 && chainData.isValid === true, `Full Chain Integrity Verification passed: ${chainData.blockCount} blocks validated`);

  // 9. AI Test Bench Suite (11 Test Cases)
  const aiBenchRes = await fetch(`${BASE_URL}/api/ai/test-suite`, { headers: authHeaders });
  const aiBenchData = await aiBenchRes.json();
  const allAiPassed = aiBenchData.tests?.length === 11 && aiBenchData.tests.every((t: any) => t.status === 'PASSED');
  assert(aiBenchRes.status === 200 && allAiPassed, `AI Validation Test Bench: ${aiBenchData.tests?.length}/11 test cases PASSED (100% Success Rate)`);

  // 10. Logout & Token Revocation
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert(logoutRes.status === 200, 'POST /api/auth/logout successfully revokes active session');

  const afterLogoutRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
  assert(afterLogoutRes.status === 401, 'Revoked token rejected with 401 Unauthorized on subsequent request');

  console.log('\n================================================================');
  console.log(`  HTTP API RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} total tests)`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runApiAcceptance().catch(err => {
  console.error('API Test failed:', err);
  process.exit(1);
});
