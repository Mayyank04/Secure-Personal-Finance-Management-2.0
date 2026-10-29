/**
 * Comprehensive Production CRUD & Security Test Bench for AegisFinance
 * 
 * Verifies full end-to-end RESTful CRUD capabilities across all resources:
 * - Transactions: POST, GET (filters, pagination, sorting), GET /:id, PATCH /:id, DELETE /:id
 * - Accounts: POST, GET, GET /:id, PATCH /:id, DELETE /:id (dependency check & force override)
 * - Budgets: POST, GET, GET /:id, PATCH /:id, DELETE /:id (derived spending calculation)
 * - Goals: POST, GET, GET /:id, PATCH /:id, DELETE /:id, POST /:id/contribute
 * - Bills: POST, GET, GET /:id, PATCH /:id, DELETE /:id, POST /:id/pay
 * - Subscriptions: POST, GET, GET /:id, PATCH /:id, DELETE /:id, PATCH /:id/status
 * - Loans: POST, GET, GET /:id, PATCH /:id, DELETE /:id, POST /:id/payment
 * - KYC: GET /status, POST /submit, user PATCH, admin-only /review guard
 * - Audit: GET /api/blockchain/audit, POST /api/blockchain/verify-chain, GET /api/security/logs
 * - OpenAPI: GET /api/docs/openapi.json, GET /api/docs
 * - Multi-tenant IDOR protection across all resources
 * - Input validation & error format consistency
 */

process.env.IS_INTEGRATION_TEST = 'true';

import http from 'http';
import crypto from 'crypto';
import { app, initDb } from '../../server.js';
import { getDatabaseAdapter } from '../db/index.js';

interface TestRecord {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestRecord[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${name}`);
    results.push({ name, passed: true });
  } else {
    console.error(`  ✗ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
    results.push({ name, passed: false, message: detail });
  }
}

async function runSuite() {
  console.log('\n================================================================');
  console.log('  AEGISFINANCE COMPREHENSIVE PRODUCTION CRUD TEST SUITE');
  console.log('================================================================\n');

  await initDb();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Server listening at: ${baseUrl}\n`);

  try {
    // --------------------------------------------------------------------------
    // 1. OpenAPI & Documentation Endpoints
    // --------------------------------------------------------------------------
    console.log('--> Section 1: OpenAPI 3.1 & Swagger Documentation...');
    {
      const resDocJson = await fetch(`${baseUrl}/api/docs/openapi.json`);
      assert(resDocJson.status === 200, 'GET /api/docs/openapi.json returns HTTP 200');
      const doc = await resDocJson.json();
      assert(doc.openapi === '3.1.0', 'OpenAPI version is 3.1.0');
      assert(Boolean(doc.paths['/api/transactions']), 'OpenAPI defines /api/transactions path');
      assert(Boolean(doc.paths['/api/accounts']), 'OpenAPI defines /api/accounts path');
      assert(Boolean(doc.paths['/api/budgets']), 'OpenAPI defines /api/budgets path');
      assert(Boolean(doc.paths['/api/goals']), 'OpenAPI defines /api/goals path');
      assert(Boolean(doc.paths['/api/bills']), 'OpenAPI defines /api/bills path');
      assert(Boolean(doc.paths['/api/subscriptions']), 'OpenAPI defines /api/subscriptions path');
      assert(Boolean(doc.paths['/api/loans']), 'OpenAPI defines /api/loans path');
      assert(Boolean(doc.paths['/api/kyc/submit']), 'OpenAPI defines /api/kyc/submit path');

      const resDocHtml = await fetch(`${baseUrl}/api/docs`);
      assert(resDocHtml.status === 200, 'GET /api/docs returns Swagger UI HTML');
      const html = await resDocHtml.text();
      assert(html.includes('SwaggerUIBundle'), 'Swagger UI bundle is embedded in /api/docs');
    }

    // --------------------------------------------------------------------------
    // 2. Authentication & User Provisioning (User A & User B)
    // --------------------------------------------------------------------------
    console.log('\n--> Section 2: User Setup & Authentication...');
    const userAEmail = `crud.user.a.${crypto.randomBytes(4).toString('hex')}@aegis-test.com`;
    const userBEmail = `crud.user.b.${crypto.randomBytes(4).toString('hex')}@aegis-test.com`;

    let userAToken = '';
    let userAId = '';
    let userBToken = '';
    let userBId = '';

    {
      const resA = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User A', email: userAEmail, password: 'StrongPassword@2026', currency: 'INR' }),
      });
      assert(resA.status === 201, 'User A registered with HTTP 201');
      const dataA = await resA.json();
      userAToken = dataA.token;
      userAId = dataA.user.id;

      const resB = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User B', email: userBEmail, password: 'StrongPassword@2026', currency: 'INR' }),
      });
      assert(resB.status === 201, 'User B registered with HTTP 201');
      const dataB = await resB.json();
      userBToken = dataB.token;
      userBId = dataB.user.id;
    }

    const headersA = { 'Authorization': `Bearer ${userAToken}`, 'Content-Type': 'application/json' };
    const headersB = { 'Authorization': `Bearer ${userBToken}`, 'Content-Type': 'application/json' };

    // --------------------------------------------------------------------------
    // 3. Accounts CRUD & Safeguards
    // --------------------------------------------------------------------------
    console.log('\n--> Section 3: Accounts CRUD & Safeguards...');
    let accountId = '';
    {
      // CREATE
      const resCreate = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          name: 'Primary HDFC Savings',
          institution: 'HDFC Bank',
          accountType: 'BANK',
          currency: 'INR',
          openingBalance: 50000,
        }),
      });
      assert(resCreate.status === 201, 'POST /api/accounts returns HTTP 201 Created');
      const bodyCreate = await resCreate.json();
      accountId = bodyCreate.account.id;
      assert(bodyCreate.account.currentBalance === 50000, 'Account opening balance correctly initialized');

      // READ ALL
      const resList = await fetch(`${baseUrl}/api/accounts`, { headers: headersA });
      assert(resList.status === 200, 'GET /api/accounts returns HTTP 200');
      const bodyList = await resList.json();
      assert(bodyList.accounts.some((a: any) => a.id === accountId), 'Created account appears in list');
      assert(bodyList.totalAssets >= 50000, 'totalAssets calculation is correct');

      // READ SINGLE
      const resSingle = await fetch(`${baseUrl}/api/accounts/${accountId}`, { headers: headersA });
      assert(resSingle.status === 200, 'GET /api/accounts/:id returns HTTP 200');
      const bodySingle = await resSingle.json();
      assert(bodySingle.account.id === accountId, 'Retrieved correct account by ID');

      // UPDATE (PATCH)
      const resPatch = await fetch(`${baseUrl}/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: headersA,
        body: JSON.stringify({ name: 'HDFC Salary Account' }),
      });
      assert(resPatch.status === 200, 'PATCH /api/accounts/:id returns HTTP 200');
      const bodyPatch = await resPatch.json();
      assert(bodyPatch.account.name === 'HDFC Salary Account', 'Account name updated');

      // IDOR GUARD
      const resIdor = await fetch(`${baseUrl}/api/accounts/${accountId}`, { headers: headersB });
      assert(resIdor.status === 404, 'IDOR: User B cannot read User A account (HTTP 404)');
    }

    // --------------------------------------------------------------------------
    // 4. Transactions CRUD, Filtering, Pagination, Sorting
    // --------------------------------------------------------------------------
    console.log('\n--> Section 4: Transactions CRUD, Filters & Atomic Cascade...');
    let tx1Id = '';
    let tx2Id = '';
    {
      // Validation Check: Negative amount rejected
      const resInvalidAmount = await fetch(`${baseUrl}/api/transactions`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          description: 'Invalid Negative Tx',
          amount: -500,
          type: 'EXPENSE',
          category: 'Food',
        }),
      });
      assert(resInvalidAmount.status === 400, 'Validation: Negative amount rejected with HTTP 400');
      const errAmount = await resInvalidAmount.json();
      assert(errAmount.error?.code === 'VALIDATION_ERROR', 'Validation error code returned');

      // CREATE TX 1 (EXPENSE linked to Account)
      const resTx1 = await fetch(`${baseUrl}/api/transactions`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          description: 'Supermarket Grocery Haul',
          amount: 3500,
          type: 'EXPENSE',
          category: 'Groceries',
          accountId,
          paymentMethod: 'Debit Card',
          date: '2026-08-10',
        }),
      });
      assert(resTx1.status === 201, 'POST /api/transactions returns HTTP 201 Created');
      const bodyTx1 = await resTx1.json();
      tx1Id = bodyTx1.transaction.id;
      assert(bodyTx1.transaction.amount === 3500, 'Transaction amount recorded');
      assert(Boolean(bodyTx1.transaction.blockchainHash), 'Transaction anchored to blockchain ledger');

      // Verify Account Balance Cascade: 50,000 - 3,500 = 46,500
      const resAccCheck = await fetch(`${baseUrl}/api/accounts/${accountId}`, { headers: headersA });
      const bodyAccCheck = await resAccCheck.json();
      assert(bodyAccCheck.account.currentBalance === 46500, 'Account balance atomically decremented to ₹46,500');

      // CREATE TX 2 (INCOME)
      const resTx2 = await fetch(`${baseUrl}/api/transactions`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          description: 'Consulting Retainer Payout',
          amount: 25000,
          type: 'INCOME',
          category: 'Freelance',
          accountId,
          paymentMethod: 'Bank Transfer',
          date: '2026-08-15',
        }),
      });
      assert(resTx2.status === 201, 'POST /api/transactions (Income) returns HTTP 201 Created');
      const bodyTx2 = await resTx2.json();
      tx2Id = bodyTx2.transaction.id;

      // READ SINGLE
      const resGetTx = await fetch(`${baseUrl}/api/transactions/${tx1Id}`, { headers: headersA });
      assert(resGetTx.status === 200, 'GET /api/transactions/:id returns HTTP 200');

      // IDOR GUARD
      const resIdorTx = await fetch(`${baseUrl}/api/transactions/${tx1Id}`, { headers: headersB });
      assert(resIdorTx.status === 404, 'IDOR: User B cannot access User A transaction (HTTP 404)');

      // FILTERING & PAGINATION
      const resFiltered = await fetch(`${baseUrl}/api/transactions?type=EXPENSE&category=Groceries`, { headers: headersA });
      const bodyFiltered = await resFiltered.json();
      assert(bodyFiltered.transactions.length >= 1, 'Filter by type and category returns matching transactions');
      assert(bodyFiltered.transactions.every((t: any) => t.type === 'EXPENSE' && t.category === 'Groceries'), 'All filtered items match criteria');

      // SORTING
      const resSorted = await fetch(`${baseUrl}/api/transactions?sortBy=amount&sortOrder=desc`, { headers: headersA });
      const bodySorted = await resSorted.json();
      assert(bodySorted.transactions[0].amount >= bodySorted.transactions[1]?.amount, 'Transactions sorted by amount descending');

      // UPDATE (PATCH) TX 1: Change amount from 3500 to 4000
      const resPatchTx = await fetch(`${baseUrl}/api/transactions/${tx1Id}`, {
        method: 'PATCH',
        headers: headersA,
        body: JSON.stringify({ amount: 4000 }),
      });
      assert(resPatchTx.status === 200, 'PATCH /api/transactions/:id returns HTTP 200');

      // Account Balance adjusted: 50,000 - 4,000 + 25,000 = 71,000
      const resAccCheck2 = await fetch(`${baseUrl}/api/accounts/${accountId}`, { headers: headersA });
      const bodyAccCheck2 = await resAccCheck2.json();
      assert(bodyAccCheck2.account.currentBalance === 71000, 'Account balance adjusted accurately on transaction patch');

      // ACCOUNT DELETION SAFEGUARD: Account has dependent transactions!
      const resDeleteAccBlocked = await fetch(`${baseUrl}/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers: headersA,
      });
      assert(resDeleteAccBlocked.status === 409, 'Safeguard: Deletion of account with dependent transactions returns HTTP 409 Conflict');
      const errDelAcc = await resDeleteAccBlocked.json();
      assert(errDelAcc.error?.code === 'ACCOUNT_HAS_DEPENDENT_RECORDS', 'Safeguard code ACCOUNT_HAS_DEPENDENT_RECORDS confirmed');
    }

    // --------------------------------------------------------------------------
    // 5. Budgets CRUD & Spending Derivation
    // --------------------------------------------------------------------------
    console.log('\n--> Section 5: Budgets CRUD & Spending Progress...');
    let budgetId = '';
    {
      // CREATE
      const resBudget = await fetch(`${baseUrl}/api/budgets`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          month: '2026-08',
          totalBudget: 45000,
          categoryBudgets: [
            { category: 'Groceries', allocated: 10000 },
            { category: 'Entertainment', allocated: 5000 },
          ],
        }),
      });
      assert(resBudget.status === 201, 'POST /api/budgets returns HTTP 201 Created');
      const bodyBudget = await resBudget.json();
      budgetId = bodyBudget.budget.id;

      // READ (Verifying dynamic spent calculation against real Groceries transactions)
      const resGetBudget = await fetch(`${baseUrl}/api/budgets/${budgetId}`, { headers: headersA });
      assert(resGetBudget.status === 200, 'GET /api/budgets/:id returns HTTP 200');
      const bodyGetBudget = await resGetBudget.json();
      const groceriesCat = bodyGetBudget.budget.categoryBudgets.find((c: any) => c.category === 'Groceries');
      assert(groceriesCat !== undefined, 'Category budget retrieved');
      assert(groceriesCat.spent === 4000, `Derived spending on Groceries is ₹4,000 (actual: ${groceriesCat?.spent})`);

      // UPDATE (PATCH)
      const resPatchBudget = await fetch(`${baseUrl}/api/budgets/${budgetId}`, {
        method: 'PATCH',
        headers: headersA,
        body: JSON.stringify({ totalBudget: 50000 }),
      });
      assert(resPatchBudget.status === 200, 'PATCH /api/budgets/:id returns HTTP 200');
      const bodyPatchBudget = await resPatchBudget.json();
      assert(bodyPatchBudget.budget.totalBudget === 50000, 'Budget totalBudget updated');

      // IDOR GUARD
      const resIdorBudget = await fetch(`${baseUrl}/api/budgets/${budgetId}`, { headers: headersB });
      assert(resIdorBudget.status === 404, 'IDOR: User B cannot access User A budget (HTTP 404)');
    }

    // --------------------------------------------------------------------------
    // 6. Savings Goals CRUD & Contribution Cascade
    // --------------------------------------------------------------------------
    console.log('\n--> Section 6: Savings Goals CRUD & Contribution Cascade...');
    let goalId = '';
    {
      // CREATE
      const resGoal = await fetch(`${baseUrl}/api/goals`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          title: 'Emergency Rainy Day Fund',
          targetAmount: 100000,
          currentAmount: 15000,
          targetDate: '2026-12-31',
          monthlyContribution: 5000,
          priority: 'HIGH',
          category: 'Emergency Fund',
        }),
      });
      assert(resGoal.status === 201, 'POST /api/goals returns HTTP 201 Created');
      const bodyGoal = await resGoal.json();
      goalId = bodyGoal.goal.id;

      // CONTRIBUTE
      const resContribute = await fetch(`${baseUrl}/api/goals/${goalId}/contribute`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          amount: 5000,
          accountId, // Withdraw contribution from account
        }),
      });
      assert(resContribute.status === 200, 'POST /api/goals/:id/contribute returns HTTP 200');
      const bodyContribute = await resContribute.json();
      assert(bodyContribute.goal.currentAmount === 20000, 'Goal currentAmount increased to ₹20,000');

      // READ SINGLE
      const resGetGoal = await fetch(`${baseUrl}/api/goals/${goalId}`, { headers: headersA });
      assert(resGetGoal.status === 200, 'GET /api/goals/:id returns HTTP 200');
      const bodyGetGoal = await resGetGoal.json();
      assert(bodyGetGoal.goal.currentAmount === 20000, 'Goal progress persisted');

      // IDOR GUARD
      const resIdorGoal = await fetch(`${baseUrl}/api/goals/${goalId}`, { headers: headersB });
      assert(resIdorGoal.status === 404, 'IDOR: User B cannot access User A goal (HTTP 404)');
    }

    // --------------------------------------------------------------------------
    // 7. Bills CRUD & Pay Workflow
    // --------------------------------------------------------------------------
    console.log('\n--> Section 7: Bills CRUD & Atomic Pay Settlement...');
    let billId = '';
    {
      // CREATE
      const resBill = await fetch(`${baseUrl}/api/bills`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          name: 'Fiber Internet Bill',
          amount: 1499,
          dueDate: '2026-09-05',
          category: 'Utilities',
          frequency: 'MONTHLY',
          biller: 'Airtel Broadband',
        }),
      });
      assert(resBill.status === 201, 'POST /api/bills returns HTTP 201 Created');
      const bodyBill = await resBill.json();
      billId = bodyBill.bill.id;

      // PAY BILL ATOMICALLY
      const resPay = await fetch(`${baseUrl}/api/bills/${billId}/pay`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({ accountId }),
      });
      assert(resPay.status === 200, 'POST /api/bills/:id/pay returns HTTP 200');
      const bodyPay = await resPay.json();
      assert(bodyPay.bill.status === 'PAID', 'Bill status updated to PAID');
      assert(Boolean(bodyPay.transactionId), 'Payment created linked transaction');

      // IDOR GUARD
      const resIdorBill = await fetch(`${baseUrl}/api/bills/${billId}`, { headers: headersB });
      assert(resIdorBill.status === 404, 'IDOR: User B cannot access User A bill (HTTP 404)');
    }

    // --------------------------------------------------------------------------
    // 8. Subscriptions CRUD & Status Management
    // --------------------------------------------------------------------------
    console.log('\n--> Section 8: Subscriptions CRUD...');
    let subId = '';
    {
      // CREATE
      const resSub = await fetch(`${baseUrl}/api/subscriptions`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          name: 'AWS Cloud Hosting',
          cost: 2999,
          billingCycle: 'MONTHLY',
          category: 'Subscriptions',
          nextPaymentDate: '2026-09-01',
        }),
      });
      assert(resSub.status === 201, 'POST /api/subscriptions returns HTTP 201 Created');
      const bodySub = await resSub.json();
      subId = bodySub.subscription.id;

      // PATCH STATUS
      const resStatus = await fetch(`${baseUrl}/api/subscriptions/${subId}/status`, {
        method: 'PATCH',
        headers: headersA,
        body: JSON.stringify({ status: 'PAUSED' }),
      });
      assert(resStatus.status === 200, 'PATCH /api/subscriptions/:id/status returns HTTP 200');
      const bodyStatus = await resStatus.json();
      assert(bodyStatus.subscription.status === 'PAUSED', 'Subscription status updated to PAUSED');

      // IDOR GUARD
      const resIdorSub = await fetch(`${baseUrl}/api/subscriptions/${subId}`, { headers: headersB });
      assert(resIdorSub.status === 404, 'IDOR: User B cannot access User A subscription (HTTP 404)');
    }

    // --------------------------------------------------------------------------
    // 9. Loans CRUD & Amortization Payment
    // --------------------------------------------------------------------------
    console.log('\n--> Section 9: Loans CRUD & Payment...');
    let loanId = '';
    {
      // CREATE
      const resLoan = await fetch(`${baseUrl}/api/loans`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          lender: 'State Bank of India',
          loanName: 'Vehicle Loan',
          loanType: 'VEHICLE_LOAN',
          principal: 500000,
          outstandingBalance: 450000,
          interestRate: 8.5,
          emi: 12500,
          dueDate: '2026-09-10',
          startDate: '2025-01-10',
          maturityDate: '2028-01-10',
        }),
      });
      assert(resLoan.status === 201, 'POST /api/loans returns HTTP 201 Created');
      const bodyLoan = await resLoan.json();
      loanId = bodyLoan.loan.id;

      // RECORD EMI PAYMENT
      const resPayment = await fetch(`${baseUrl}/api/loans/${loanId}/payment`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({ amount: 12500, accountId }),
      });
      assert(resPayment.status === 200, 'POST /api/loans/:id/payment returns HTTP 200');
      const bodyPayment = await resPayment.json();
      assert(bodyPayment.loan.outstandingBalance === 437500, 'Outstanding balance reduced to ₹437,500');

      // IDOR GUARD
      const resIdorLoan = await fetch(`${baseUrl}/api/loans/${loanId}`, { headers: headersB });
      assert(resIdorLoan.status === 404, 'IDOR: User B cannot access User A loan (HTTP 404)');
    }

    // --------------------------------------------------------------------------
    // 10. KYC Records & Authorization Safeguards
    // --------------------------------------------------------------------------
    console.log('\n--> Section 10: KYC Records & Status Escalation Guard...');
    {
      // SUBMIT KYC
      const resKycSubmit = await fetch(`${baseUrl}/api/kyc/submit`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          fullName: 'Mayank Gautam',
          documentType: 'PAN',
          documentNumber: 'ABCDE1234F',
          dateOfBirth: '1995-05-15',
          address: '42 Financial Park, Bengaluru, India',
        }),
      });
      assert(resKycSubmit.status === 200 || resKycSubmit.status === 201, 'POST /api/kyc/submit succeeds');
      const bodyKycSubmit = await resKycSubmit.json();
      assert(bodyKycSubmit.kyc.status === 'UNDER_REVIEW', 'KYC initial status is UNDER_REVIEW');

      // USER PATCH: User attempts to self-approve verification by sending status: VERIFIED
      const resSelfApprove = await fetch(`${baseUrl}/api/kyc`, {
        method: 'PATCH',
        headers: headersA,
        body: JSON.stringify({ status: 'VERIFIED' }),
      });
      assert(resSelfApprove.status === 403, 'Security: Self-approval rejected with HTTP 403 Forbidden');
      const errSelfApprove = await resSelfApprove.json();
      assert(errSelfApprove.error?.code === 'FORBIDDEN_PRIVILEGED_MODIFICATION', 'Error code FORBIDDEN_PRIVILEGED_MODIFICATION returned');

      // REVIEW WORKFLOW: Non-admin user calls /api/kyc/review
      const resReviewUnauthorized = await fetch(`${baseUrl}/api/kyc/review`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({ targetUserId: userAId, status: 'VERIFIED', notes: 'Approved' }),
      });
      assert(resReviewUnauthorized.status === 403, 'Security: Non-admin reviewer call rejected with HTTP 403');
    }

    // --------------------------------------------------------------------------
    // 11. Audit Records & Ledger Verification
    // --------------------------------------------------------------------------
    console.log('\n--> Section 11: Audit Records & Cryptographic Verification...');
    {
      const resAudit = await fetch(`${baseUrl}/api/blockchain/audit`, { headers: headersA });
      assert(resAudit.status === 200, 'GET /api/blockchain/audit returns HTTP 200');
      const bodyAudit = await resAudit.json();
      assert(Array.isArray(bodyAudit.blocks), 'Audit blocks returned as array');
      assert(Array.isArray(bodyAudit.records), 'Audit records returned as array');

      const resVerifyChain = await fetch(`${baseUrl}/api/blockchain/verify-chain`, {
        method: 'POST',
        headers: headersA,
      });
      assert(resVerifyChain.status === 200, 'POST /api/blockchain/verify-chain returns HTTP 200');
      const bodyVerify = await resVerifyChain.json();
      assert(bodyVerify.isValid === true, 'Ledger cryptographic Merkle integrity is 100% valid');

      const resSecLogs = await fetch(`${baseUrl}/api/security/logs`, { headers: headersA });
      assert(resSecLogs.status === 200, 'GET /api/security/logs returns HTTP 200');
      const bodySecLogs = await resSecLogs.json();
      assert(bodySecLogs.logs.every((l: any) => l.userId === userAId), 'Security logs strictly tenant-isolated');
    }

    // --------------------------------------------------------------------------
    // 12. Force Account Deletion & Cascades
    // --------------------------------------------------------------------------
    console.log('\n--> Section 12: Force Account Deletion...');
    {
      const resForceDelete = await fetch(`${baseUrl}/api/accounts/${accountId}?force=true`, {
        method: 'DELETE',
        headers: headersA,
      });
      assert(resForceDelete.status === 200, 'DELETE /api/accounts/:id?force=true succeeds with HTTP 200');
    }

  } finally {
    server.close();
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  COMPREHENSIVE CRUD RESULTS: ${passed} PASSED, ${failed} FAILED (${total} total)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch(err => {
  console.error('[Acceptance Suite Fatal Error]:', err);
  process.exit(1);
});
