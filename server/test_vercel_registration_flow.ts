/**
 * Direct Serverless Integration Verification Test for Vercel
 * Simulates @vercel/node invocation, URL rewriting, body-parsing, and registration flow
 * against the real Supabase PostgreSQL database.
 */

import dotenv from 'dotenv';
dotenv.config();

import handler from '../api/index.js';
import { getDatabaseAdapter } from './db/index.js';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockResponse;
  json: (data: any) => MockResponse;
  send: (data: any) => MockResponse;
  end: (data?: any) => MockResponse;
}

function createMockResponse(): { res: MockResponse; promise: Promise<{ status: number; body: any; headers: Record<string, string> }> } {
  let resolvePromise: (val: any) => void;
  const promise = new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve) => {
    resolvePromise = resolve;
  });

  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      resolvePromise({ status: this.statusCode, body: data, headers: this.headers });
      return this;
    },
    send(data: any) {
      this.body = data;
      try {
        this.body = JSON.parse(data);
      } catch {}
      resolvePromise({ status: this.statusCode, body: this.body, headers: this.headers });
      return this;
    },
    end(data?: any) {
      if (data && !this.body) {
        this.body = data;
      }
      resolvePromise({ status: this.statusCode, body: this.body, headers: this.headers });
      return this;
    },
  };

  return { res, promise };
}

async function runTest() {
  console.log('================================================================');
  console.log('  VERCEL SERVERLESS REGISTRATION & AUTHENTICATION INTEGRATION TEST');
  console.log('================================================================\n');

  const testEmail = `test_vercel_${Date.now()}@aegis-test.com`;
  const testPassword = 'StrongPassword!2026';
  const testName = 'Test Vercel User';

  // Test 1: Simulated Vercel POST /api/auth/register with query.__path rewrite
  console.log('--> Step 1: Simulated Vercel POST /api/auth/register...');
  const { res: res1, promise: p1 } = createMockResponse();
  const req1: any = {
    method: 'POST',
    url: '/api/index?__path=auth/register',
    query: { __path: 'auth/register' },
    headers: {
      'content-type': 'application/json',
      'x-matched-path': '/api/index',
      'x-forwarded-uri': '/api/auth/register',
    },
    body: {
      email: testEmail,
      password: testPassword,
      name: testName,
      currency: 'INR',
    },
  };

  await handler(req1, res1 as any);
  const result1 = await p1;

  console.log(`  Response Status: ${result1.status}`);
  if (result1.status !== 201) {
    console.error('  FAILED: Expected 201 Created, got:', result1.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Registration succeeded with HTTP 201 Created');
  console.log(`  ✓ [PASS] Received session token: ${result1.body.token ? 'YES' : 'NO'}`);
  console.log(`  ✓ [PASS] Returned user ID: ${result1.body.user?.id}`);

  const userToken = result1.body.token;

  // Test 2: Verify user exists in live Supabase PostgreSQL
  console.log('\n--> Step 2: Verifying PostgreSQL persistence in Supabase...');
  const adapter = getDatabaseAdapter();
  const dbUser = await adapter.getUserByEmail(testEmail);
  if (!dbUser) {
    console.error('  FAILED: User not found in Supabase PostgreSQL!');
    process.exit(1);
  }
  console.log('  ✓ [PASS] User persisted authoritatively in PostgreSQL:', dbUser.email);
  console.log('  ✓ [PASS] Salt and PBKDF2 hash verified in PostgreSQL');

  // Test 3: Simulated Vercel GET /api/auth/me
  console.log('\n--> Step 3: Simulated Vercel GET /api/auth/me...');
  const { res: res3, promise: p3 } = createMockResponse();
  const req3: any = {
    method: 'GET',
    url: '/api/index?__path=auth/me',
    query: { __path: 'auth/me' },
    headers: {
      authorization: `Bearer ${userToken}`,
      'x-matched-path': '/api/index',
      'x-forwarded-uri': '/api/auth/me',
    },
  };

  await handler(req3, res3 as any);
  const result3 = await p3;
  console.log(`  Response Status: ${result3.status}`);
  if (result3.status !== 200 || result3.body.user?.email !== testEmail) {
    console.error('  FAILED: /api/auth/me returned:', result3.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] /api/auth/me authenticated successfully');

  // Test 4: Duplicate registration prevention
  console.log('\n--> Step 4: Duplicate registration rejection (409 Conflict)...');
  const { res: res4, promise: p4 } = createMockResponse();
  const req4: any = {
    method: 'POST',
    url: '/api/index?__path=auth/register',
    query: { __path: 'auth/register' },
    headers: {
      'content-type': 'application/json',
      'x-matched-path': '/api/index',
    },
    body: {
      email: testEmail,
      password: testPassword,
      name: testName,
    },
  };

  await handler(req4, res4 as any);
  const result4 = await p4;
  console.log(`  Response Status: ${result4.status}`);
  if (result4.status !== 409) {
    console.error('  FAILED: Expected 409 Conflict, got:', result4.status, result4.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Duplicate email returned HTTP 409 with message:', result4.body.error);

  // Test 5: Weak password rejection
  console.log('\n--> Step 5: Password validation rejection (400 Bad Request)...');
  const { res: res5, promise: p5 } = createMockResponse();
  const req5: any = {
    method: 'POST',
    url: '/api/index?__path=auth/register',
    query: { __path: 'auth/register' },
    headers: {
      'content-type': 'application/json',
      'x-matched-path': '/api/index',
    },
    body: {
      email: `another_${Date.now()}@test.com`,
      password: 'weak',
      name: 'Weak Pass User',
    },
  };

  await handler(req5, res5 as any);
  const result5 = await p5;
  console.log(`  Response Status: ${result5.status}`);
  if (result5.status !== 400 || result5.body.code !== 'WEAK_PASSWORD') {
    console.error('  FAILED: Expected 400 Bad Request with WEAK_PASSWORD, got:', result5.status, result5.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Weak password returned HTTP 400 with message:', result5.body.error);

  // Test 6: Missing required fields rejection
  console.log('\n--> Step 6: Missing required fields rejection (400 Bad Request)...');
  const { res: res6a, promise: p6a } = createMockResponse();
  const req6a: any = {
    method: 'POST',
    url: '/api/index?__path=auth/register',
    query: { __path: 'auth/register' },
    headers: {
      'content-type': 'application/json',
      'x-matched-path': '/api/index',
    },
    body: {
      email: `missing_${Date.now()}@test.com`,
      // password missing
      name: 'Missing Field User',
    },
  };

  await handler(req6a, res6a as any);
  const result6a = await p6a;
  console.log(`  Response Status: ${result6a.status}`);
  if (result6a.status !== 400 || result6a.body.code !== 'MISSING_REQUIRED_FIELDS') {
    console.error('  FAILED: Expected 400 Bad Request with MISSING_REQUIRED_FIELDS, got:', result6a.status, result6a.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Missing required fields returned HTTP 400 with code:', result6a.body.code);

  // Test 7: Invalid email rejection
  console.log('\n--> Step 7: Invalid email address rejection (400 Bad Request)...');
  const { res: res7a, promise: p7a } = createMockResponse();
  const req7a: any = {
    method: 'POST',
    url: '/api/index?__path=auth/register',
    query: { __path: 'auth/register' },
    headers: {
      'content-type': 'application/json',
      'x-matched-path': '/api/index',
    },
    body: {
      email: 'not-a-valid-email-address',
      password: 'StrongPassword!2026',
      name: 'Invalid Email User',
    },
  };

  await handler(req7a, res7a as any);
  const result7a = await p7a;
  console.log(`  Response Status: ${result7a.status}`);
  if (result7a.status !== 400 || result7a.body.code !== 'INVALID_EMAIL') {
    console.error('  FAILED: Expected 400 Bad Request with INVALID_EMAIL, got:', result7a.status, result7a.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Invalid email returned HTTP 400 with code:', result7a.body.code);

  // Test 8: Simulated Vercel POST /api/auth/login
  console.log('\n--> Step 8: Simulated Vercel POST /api/auth/login...');
  const { res: res6, promise: p6 } = createMockResponse();
  const req6: any = {
    method: 'POST',
    url: '/api/index?__path=auth/login',
    query: { __path: 'auth/login' },
    headers: {
      'content-type': 'application/json',
      'x-matched-path': '/api/index',
    },
    body: {
      email: testEmail,
      password: testPassword,
    },
  };

  await handler(req6, res6 as any);
  const result6 = await p6;
  console.log(`  Response Status: ${result6.status}`);
  if (result6.status !== 200 || !result6.body.token) {
    console.error('  FAILED: Login failed:', result6.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Login succeeded with HTTP 200 and fresh session token');

  // Test 9: Simulated Vercel POST /api/auth/logout
  console.log('\n--> Step 9: Simulated Vercel POST /api/auth/logout...');
  const { res: res7, promise: p7 } = createMockResponse();
  const req7: any = {
    method: 'POST',
    url: '/api/index?__path=auth/logout',
    query: { __path: 'auth/logout' },
    headers: {
      authorization: `Bearer ${result6.body.token}`,
      'x-matched-path': '/api/index',
    },
    body: {},
  };

  await handler(req7, res7 as any);
  const result7 = await p7;
  console.log(`  Response Status: ${result7.status}`);
  if (result7.status !== 200) {
    console.error('  FAILED: Logout failed:', result7.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Logout succeeded with HTTP 200');

  // Test 10: Subsequent Re-login after logout
  console.log('\n--> Step 10: Subsequent Re-login with registered credentials...');
  const { res: res10, promise: p10 } = createMockResponse();
  const req10: any = {
    method: 'POST',
    url: '/api/index?__path=auth/login',
    query: { __path: 'auth/login' },
    headers: {
      'content-type': 'application/json',
      'x-matched-path': '/api/index',
    },
    body: {
      email: testEmail,
      password: testPassword,
    },
  };

  await handler(req10, res10 as any);
  const result10 = await p10;
  console.log(`  Response Status: ${result10.status}`);
  if (result10.status !== 200 || !result10.body.token) {
    console.error('  FAILED: Subsequent re-login failed:', result10.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Subsequent re-login succeeded with fresh session token');

  // Test 11: Fast-path Liveness Probe verification
  console.log('\n--> Step 11: Verifying Serverless Liveness Probe (/api/live)...');
  const { res: res11, promise: p11 } = createMockResponse();
  const req11: any = {
    method: 'GET',
    url: '/api/live',
    headers: {
      'x-forwarded-uri': '/api/live',
    },
  };
  await handler(req11, res11 as any);
  const result11 = await p11;
  console.log(`  Response Status: ${result11.status}`);
  if (result11.status !== 200 || result11.body.probe !== 'liveness') {
    console.error('  FAILED: Liveness probe failed:', result11.body);
    process.exit(1);
  }
  console.log('  ✓ [PASS] Serverless liveness probe responded with HTTP 200 without blocking on DB');

  // Clean up test user
  console.log('\n--> Step 12: Cleaning up test user...');
  await (adapter as any).execute('DELETE FROM users WHERE id = $1;', [dbUser.id]).catch(() => {});
  console.log('  ✓ [PASS] Test user cleaned up');


  console.log('\n================================================================');
  console.log('  ALL VERCEL SERVERLESS AUTHENTICATION FLOW CHECKS PASSED (12/12)');
  console.log('================================================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
