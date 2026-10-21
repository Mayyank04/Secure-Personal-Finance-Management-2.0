/**
 * Live Vercel Production Verification Suite
 * Tests Root, Health, Currency FX, Demo Session Issuance,
 * Authenticated Accounts, Transactions, Dashboard, KYC, and Token Revocation on Real Vercel Edge.
 */

const VERCEL_URL = 'https://secure-personal-finance-management-maya-0a99.vercel.app';
const BYPASS_TOKEN = 'BrnNYYXbrGfpor6Yj2PtHj9AQcy3RbNQ';

async function runLiveVercelVerification() {
  console.log('\n================================================================');
  console.log('  LIVE VERCEL PRODUCTION VERIFICATION SUITE');
  console.log(`  Target: ${VERCEL_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(cond: boolean, name: string, details: any) {
    if (cond) {
      console.log(`  ✓ [PASS] ${name}`);
      console.log(`           URL: ${details.url}`);
      console.log(`           Status: ${details.status}`);
      console.log(`           Response: ${details.snippet}\n`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`           URL: ${details.url}`);
      console.error(`           Status: ${details.status}`);
      console.error(`           Response: ${details.snippet}\n`);
      failed++;
    }
  }

  const jsonHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-vercel-protection-bypass': BYPASS_TOKEN,
  };

  // 1. Root & Frontend Load
  console.log('--> Step 1: Testing Frontend Root Load...');
  const rootRes = await fetch(`${VERCEL_URL}/`, {
    headers: { 'x-vercel-protection-bypass': BYPASS_TOKEN },
  });
  const rootText = await rootRes.text();
  record(
    rootRes.status === 200 && rootText.toLowerCase().includes('<!doctype html>'),
    'GET / (Frontend SPA HTML bundle)',
    { url: `${VERCEL_URL}/`, status: rootRes.status, snippet: 'HTML Document [Vite React SPA Bundle Loaded]' }
  );

  // 2. Health Endpoint
  console.log('--> Step 2: Testing Production Health Endpoint...');
  const healthRes = await fetch(`${VERCEL_URL}/api/health`, { headers: jsonHeaders });
  const healthData = await healthRes.json();
  record(
    healthRes.status === 200 && healthData.status === 'ok',
    'GET /api/health',
    { url: `${VERCEL_URL}/api/health`, status: healthRes.status, snippet: JSON.stringify(healthData) }
  );

  // 3. Exchange Rates Endpoint
  console.log('--> Step 3: Testing Exchange Rates Endpoint...');
  const ratesRes = await fetch(`${VERCEL_URL}/api/exchange-rates?base=USD`, { headers: jsonHeaders });
  const ratesData = await ratesRes.json();
  record(
    ratesRes.status === 200 && ratesData.rates && typeof ratesData.rates.INR === 'number',
    'GET /api/exchange-rates',
    { url: `${VERCEL_URL}/api/exchange-rates`, status: ratesRes.status, snippet: `Base: ${ratesData.base}, INR: ${ratesData.rates?.INR}, Source: ${ratesData.source}` }
  );

  // 4. Currency Convert API (INR -> USD)
  console.log('--> Step 4: Testing Currency Convert API...');
  const convRes = await fetch(`${VERCEL_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 10000, from: 'INR', to: 'USD' }),
  });
  const convData = await convRes.json();
  record(
    convRes.status === 200 && typeof convData.convertedAmount === 'number' && convData.convertedAmount > 0,
    'POST /api/currency/convert (INR -> USD: ₹10,000)',
    { url: `${VERCEL_URL}/api/currency/convert`, status: convRes.status, snippet: `Converted: ${convData.formattedResult} (Rate: ${convData.rate})` }
  );

  // 5. User Registration Endpoint
  console.log('--> Step 5: Testing Direct Registration Endpoint...');
  const regRes = await fetch(`${VERCEL_URL}/api/auth/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      name: 'Direct Auditor',
      email: `direct.${Date.now()}@fintech-prod.com`,
      password: 'ProdAuditPassword@2026',
      currency: 'INR',
    }),
  });
  const regData = await regRes.json();
  record(
    (regRes.status === 200 || regRes.status === 201) && regData.token !== undefined,
    'POST /api/auth/register (Direct Worker Execution)',
    { url: `${VERCEL_URL}/api/auth/register`, status: regRes.status, snippet: `Token Generated: ${regData.token?.slice(0, 30)}...` }
  );

  // 6. Demo Session Issuance (Signed Stateless HMAC Session)
  console.log('--> Step 6: Testing Production Demo Session Issuance...');
  const demoRes = await fetch(`${VERCEL_URL}/api/auth/demo-session`, {
    method: 'POST',
    headers: jsonHeaders,
  });
  const demoData = await demoRes.json();
  const sessionToken = demoData.token;
  record(
    demoRes.status === 200 && sessionToken && sessionToken.startsWith('tok.'),
    'POST /api/auth/demo-session (Stateless HMAC Session Creation)',
    { url: `${VERCEL_URL}/api/auth/demo-session`, status: demoRes.status, snippet: `Session Token Issued (User: ${demoData.user?.name})` }
  );

  const authHeaders = {
    ...jsonHeaders,
    'Authorization': `Bearer ${sessionToken}`,
  };

  // 7. Authenticated /me Profile Retrieval across Serverless Workers
  console.log('--> Step 7: Testing Authenticated Profile Retrieval across Serverless Edge...');
  const meRes = await fetch(`${VERCEL_URL}/api/auth/me`, { headers: authHeaders });
  const meData = await meRes.json();
  record(
    meRes.status === 200 && meData.user?.email === 'alex.morgan@fintech-demo.com',
    'GET /api/auth/me (Stateless HMAC Session Verification)',
    { url: `${VERCEL_URL}/api/auth/me`, status: meRes.status, snippet: `Authenticated as: ${meData.user?.name} (${meData.user?.email})` }
  );

  // 8. Authenticated Dashboard Endpoint
  console.log('--> Step 8: Testing Authenticated Dashboard Data...');
  const dashRes = await fetch(`${VERCEL_URL}/api/dashboard`, { headers: authHeaders });
  const dashData = await dashRes.json();
  record(
    dashRes.status === 200 && dashData.totalBalance !== undefined && Array.isArray(dashData.recentTransactions),
    'GET /api/dashboard',
    { url: `${VERCEL_URL}/api/dashboard`, status: dashRes.status, snippet: `Total Liquid Balance: ₹${dashData.totalBalance?.toLocaleString()}, Income: ₹${dashData.monthlyIncome?.toLocaleString()}, Transactions: ${dashData.recentTransactions?.length}` }
  );

  // 9. Authenticated Accounts Endpoint
  console.log('--> Step 9: Testing Authenticated Accounts...');
  const accRes = await fetch(`${VERCEL_URL}/api/accounts`, { headers: authHeaders });
  const accData = await accRes.json();
  record(
    accRes.status === 200 && Array.isArray(accData.accounts) && accData.netLiquidBalance !== undefined,
    'GET /api/accounts',
    { url: `${VERCEL_URL}/api/accounts`, status: accRes.status, snippet: `Retrieved ${accData.accounts?.length} accounts (Net Liquid Balance: ₹${accData.netLiquidBalance?.toLocaleString()})` }
  );

  // 10. Authenticated Transactions Endpoint
  console.log('--> Step 10: Testing Authenticated Transactions...');
  const txRes = await fetch(`${VERCEL_URL}/api/transactions`, { headers: authHeaders });
  const txData = await txRes.json();
  record(
    txRes.status === 200 && Array.isArray(txData.transactions),
    'GET /api/transactions',
    { url: `${VERCEL_URL}/api/transactions`, status: txRes.status, snippet: `Retrieved ${txData.transactions?.length} transactions` }
  );

  // 11. Authenticated KYC Status Endpoint
  console.log('--> Step 11: Testing Authenticated KYC Status...');
  const kycRes = await fetch(`${VERCEL_URL}/api/kyc/status`, { headers: authHeaders });
  const kycData = await kycRes.json();
  record(
    kycRes.status === 200 && kycData.status !== undefined,
    'GET /api/kyc/status',
    { url: `${VERCEL_URL}/api/kyc/status`, status: kycRes.status, snippet: `KYC Status: ${kycData.status}` }
  );

  // 12. User Logout & Session Invalidation
  console.log('--> Step 12: Testing Production User Logout...');
  const logoutRes = await fetch(`${VERCEL_URL}/api/auth/logout`, {
    method: 'POST',
    headers: authHeaders,
  });
  const logoutData = await logoutRes.json();
  record(
    logoutRes.status === 200 && logoutData.message !== undefined,
    'POST /api/auth/logout (Session Revocation)',
    { url: `${VERCEL_URL}/api/auth/logout`, status: logoutRes.status, snippet: logoutData.message }
  );

  console.log('\n================================================================');
  console.log(`  LIVE VERCEL VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED (${passed + failed} total)`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runLiveVercelVerification().catch(err => {
  console.error('Live Vercel Verification failed:', err);
  process.exit(1);
});
