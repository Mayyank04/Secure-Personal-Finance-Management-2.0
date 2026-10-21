/**
 * Production API & Architecture Verification Suite
 * Tests Health, Aliased Routes (/register, /login, /me), Currency Engine, and Session Security
 */

import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

async function runProductionTests() {
  console.log('\n================================================================');
  console.log('  PRODUCTION API & ARCHITECTURE ACCEPTANCE TEST SUITE');
  console.log('  Health, Aliases (/register, /login), Currency FX & Vercel Readiness');
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

  const jsonHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // 1. Health Endpoints
  console.log('--> Section 1: Health & Diagnostics...');
  const healthRes1 = await fetch(`${BASE_URL}/api/health`, { headers: jsonHeaders });
  const healthData1 = await healthRes1.json();
  assert(healthRes1.status === 200 && healthData1.status === 'ok', 'GET /api/health returns HTTP 200 OK');

  const healthRes2 = await fetch(`${BASE_URL}/health`, { headers: jsonHeaders });
  const healthData2 = await healthRes2.json();
  assert(healthRes2.status === 200 && healthData2.status === 'ok', 'GET /health alias returns HTTP 200 OK');

  // 2. Registration Route & Aliases
  console.log('\n--> Section 2: Registration Routes & Aliases...');
  const testUserEmail = `prod.test.${crypto.randomBytes(4).toString('hex')}@fintech.internal`;
  
  // Test aliased /register endpoint
  const regRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      name: 'Production Tester',
      email: testUserEmail,
      password: 'ProdPassword@2026',
      currency: 'INR',
    }),
  });
  const regData = await regRes.json();
  assert((regRes.status === 200 || regRes.status === 201) && regData.token !== undefined, 'POST /register alias returns HTTP 201/200 with valid session token');

  // Test duplicate email rejection
  const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      name: 'Duplicate Tester',
      email: testUserEmail,
      password: 'ProdPassword@2026',
    }),
  });
  assert(dupRes.status === 409, 'POST /api/auth/register returns HTTP 409 Conflict for existing email');

  // 3. Login Route & Aliases
  console.log('\n--> Section 3: Login Routes & Aliases...');
  const loginRes = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      email: testUserEmail,
      password: 'ProdPassword@2026',
    }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && loginData.token !== undefined, 'POST /login alias returns HTTP 200 with session token');

  const token = loginData.token;
  const authHeaders = {
    ...jsonHeaders,
    'Authorization': `Bearer ${token}`,
  };

  // 4. Authenticated /me Route & Aliases
  console.log('\n--> Section 4: Current User Profile /me & Aliases...');
  const meRes1 = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
  const meData1 = await meRes1.json();
  assert(meRes1.status === 200 && meData1.user?.email === testUserEmail, 'GET /api/auth/me returns authenticated user object');

  const meRes2 = await fetch(`${BASE_URL}/me`, { headers: authHeaders });
  const meData2 = await meRes2.json();
  assert(meRes2.status === 200 && meData2.user?.email === testUserEmail, 'GET /me alias returns authenticated user object');

  // 5. Currency Converter & FX Rates Service
  console.log('\n--> Section 5: Multi-Currency Converter & FX Endpoints...');
  const fxRes = await fetch(`${BASE_URL}/api/exchange-rates?base=USD`, { headers: jsonHeaders });
  const fxData = await fxRes.json();
  assert(fxRes.status === 200 && fxData.rates?.INR !== undefined, 'GET /api/exchange-rates returns FX rates with INR baseline');

  // INR -> USD conversion test (₹10,000 INR -> ~$115-$116 USD)
  const inrToUsdRes = await fetch(`${BASE_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 10000, from: 'INR', to: 'USD' }),
  });
  const inrToUsdData = await inrToUsdRes.json();
  assert(inrToUsdRes.status === 200 && inrToUsdData.convertedAmount > 0, `INR -> USD: ₹10,000 = $${inrToUsdData.convertedAmount} (Rate: ${inrToUsdData.rate})`);

  // USD -> INR conversion test ($100 USD)
  const usdToInrRes = await fetch(`${BASE_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 100, from: 'USD', to: 'INR' }),
  });
  const usdToInrData = await usdToInrRes.json();
  assert(usdToInrRes.status === 200 && usdToInrData.convertedAmount > 0, `USD -> INR: $100 = ₹${usdToInrData.convertedAmount}`);

  // EUR -> INR conversion test
  const eurToInrRes = await fetch(`${BASE_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 100, from: 'EUR', to: 'INR' }),
  });
  const eurToInrData = await eurToInrRes.json();
  assert(eurToInrRes.status === 200 && eurToInrData.convertedAmount > 0, `EUR -> INR: €100 = ₹${eurToInrData.convertedAmount}`);

  // GBP -> INR conversion test
  const gbpToInrRes = await fetch(`${BASE_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 100, from: 'GBP', to: 'INR' }),
  });
  const gbpToInrData = await gbpToInrRes.json();
  assert(gbpToInrRes.status === 200 && gbpToInrData.convertedAmount > 0, `GBP -> INR: £100 = ₹${gbpToInrData.convertedAmount}`);

  // Same currency test
  const sameCurrRes = await fetch(`${BASE_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 500, from: 'INR', to: 'INR' }),
  });
  const sameCurrData = await sameCurrRes.json();
  assert(sameCurrRes.status === 200 && sameCurrData.convertedAmount === 500 && sameCurrData.rate === 1.0, 'Same Currency (INR -> INR): Amount preserved at 1:1');

  // Zero amount test
  const zeroRes = await fetch(`${BASE_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 0, from: 'USD', to: 'INR' }),
  });
  const zeroData = await zeroRes.json();
  assert(zeroRes.status === 200 && zeroData.convertedAmount === 0, 'Zero Amount: Returns 0.00 cleanly');

  // Negative amount test (Should reject with 400)
  const negRes = await fetch(`${BASE_URL}/api/currency/convert`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: -100, from: 'USD', to: 'INR' }),
  });
  assert(negRes.status === 400, 'Negative Amount: Rejects with HTTP 400 error message');

  // 6. Logout & Session Revocation
  console.log('\n--> Section 6: Logout & Session Revocation...');
  const logoutRes = await fetch(`${BASE_URL}/logout`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert(logoutRes.status === 200, 'POST /logout alias revokes active session');

  const verifyRevokedRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
  assert(verifyRevokedRes.status === 401, 'Revoked token blocked on subsequent request (HTTP 401)');

  console.log('\n================================================================');
  console.log(`  PRODUCTION API RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} total tests)`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runProductionTests().catch(err => {
  console.error('Production test failed:', err);
  process.exit(1);
});
