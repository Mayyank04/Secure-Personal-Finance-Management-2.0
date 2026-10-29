
import {
  DashboardData,
  Transaction,
  Budget,
  SavingsGoal,
  AIInsight,
  Anomaly,
  SpendingForecast,
  MultiHorizonSpendingForecast,
  CategoryPredictionResult,
  BudgetRecommendation,
  GoalRecommendation,
  RecurringTelemetry,
  WhatIfSimulationResult,
  AiTestCaseItem,
  BlockchainBlock,
  BlockchainRecord,
  VerificationResult,
} from '../types';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('fintech_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!res.ok) {
      let errMessage = 'A network or server error occurred.';
      let errCode: string | undefined;
      try {
        const text = await res.text();
        try {
          const errorData = JSON.parse(text);
          if (errorData.error) {
            if (typeof errorData.error === 'string') {
              errMessage = errorData.error;
            } else if (typeof errorData.error === 'object' && errorData.error.message) {
              errMessage = errorData.error.message;
              if (errorData.error.code) errCode = errorData.error.code;
            } else {
              errMessage = JSON.stringify(errorData.error);
            }
          } else if (errorData.message) {
            errMessage = errorData.message;
          }
          if (errorData.code && !errCode) errCode = errorData.code;
        } catch {
          if (text && !text.includes('<!DOCTYPE') && !text.includes('<html') && text.trim().length > 0 && text.length < 300) {
            errMessage = text.trim();
          } else if (res.status === 404) {
            errMessage = 'The requested endpoint was not found (404). Please check serverless routing.';
          } else if (res.status === 503) {
            errMessage = 'Service unavailable (503). Database initialization is in progress or unreachable.';
          } else if (res.status === 500) {
            errMessage = 'An internal server error occurred (500). Please check server logs and try again.';
          }
        }
      } catch {
        // ignore read error
      }

      if (res.status === 401) {
        const isAuthAttempt =
          endpoint.includes('/api/auth/login') ||
          endpoint.includes('/api/auth/mfa/challenge') ||
          endpoint.includes('/api/auth/register') ||
          endpoint.includes('/api/security/mfa/verify');
        if (!isAuthAttempt && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('fintech_unauthorized', { detail: { message: errMessage, code: errCode } }));
        }
      }

      const error: any = new Error(errMessage);
      error.status = res.status;
      error.code = errCode;
      throw error;
    }

    return res.json() as Promise<T>;
  }

  async register(data: { name: string; email: string; password: string; currency?: string }) {
    return this.request<{ token: string; verificationToken?: string; user: any; profile: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      token?: string;
      mfaRequired?: boolean;
      mfaTicket?: string;
      email?: string;
      user?: any;
      profile?: any;
      message?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async mfaChallenge(data: { mfaTicket: string; code: string }) {
    return this.request<{ token: string; user: any; profile: any; message: string }>('/api/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async demoSession() {
    return this.request<{ token: string; isDemoMode: boolean; user: any; profile: any }>('/api/auth/demo-session', {
      method: 'POST',
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<{ message: string }>('/api/auth/password/change', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string; resetToken?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(data: { token: string; newPassword: string }) {
    return this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyEmail(token: string) {
    return this.request<{ message: string; isEmailVerified: boolean }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerification() {
    return this.request<{ message: string; verificationToken?: string }>('/api/auth/resend-verification', {
      method: 'POST',
    });
  }

  async deleteUserAccount(data: { password: string; mfaCode?: string }) {
    return this.request<{ message: string }>('/api/account/delete', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    return this.request<{ message: string }>('/api/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request<{ user: any; profile: any }>('/api/auth/me');
  }

  async toggleMfa() {
    return this.request<{ mfaEnabled: boolean; message: string }>('/api/auth/mfa/toggle', { method: 'POST' });
  }

  async saveOnboarding(data: any) {
    return this.request<{ message: string; profile: any }>('/api/profile/onboarding', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getCalendarEvents(month?: string) {
    return this.request<any>(`/api/calendar/events${month ? `?month=${month}` : ''}`);
  }

  async getNotifications() {
    return this.request<{ notifications: any[]; unreadCount: number; totalCount: number }>('/api/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<{ message: string; notification: any }>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ message: string; updatedCount: number }>('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  async deleteNotification(id: string) {
    return this.request<{ message: string }>(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  async revokeAllSessions() {
    return this.request<{ message: string; count: number }>('/api/security/sessions/revoke-all', {
      method: 'POST',
    });
  }

  async getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>('/api/dashboard');
  }

  async getTransactions(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<{
      transactions: Transaction[];
      pagination: { page: number; limit: number; totalCount: number; totalPages: number };
    }>(`/api/transactions${qs ? `?${qs}` : ''}`);
  }

  async previewCategorization(data: { description: string; amount?: number; type?: string }): Promise<CategoryPredictionResult> {
    return this.request<CategoryPredictionResult>('/api/transactions/categorize-preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createTransaction(data: Partial<Transaction>) {
    return this.request<{ message: string; transaction: Transaction; blockchainRecord: BlockchainRecord }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTransaction(id: string, data: Partial<Transaction>) {
    return this.request<{ message: string; transaction: Transaction }>(`/api/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTransaction(id: string) {
    return this.request<{ message: string }>(`/api/transactions/${id}`, { method: 'DELETE' });
  }

  async importTransactions(items: any[]) {
    return this.request<{ message: string; count: number }>('/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async getBudgets() {
    return this.request<{ budgets: Budget[] }>('/api/budgets');
  }

  async updateBudget(id: string, data: Partial<Budget>) {
    return this.request<{ message: string; budget: Budget }>(`/api/budgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createBudget(data: Partial<Budget>) {
    return this.request<{ message: string; budget: Budget }>('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGoals() {
    return this.request<{ goals: SavingsGoal[] }>('/api/goals');
  }

  async createGoal(data: Partial<SavingsGoal>) {
    return this.request<{ message: string; goal: SavingsGoal }>('/api/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async contributeToGoal(id: string, amount: number) {
    return this.request<{ message: string; goal: SavingsGoal }>(`/api/goals/${id}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getInsights() {
    return this.request<{ insights: AIInsight[] }>('/api/insights');
  }

  async getAnomalies() {
    return this.request<{ anomalies: Anomaly[]; total: number }>('/api/anomalies');
  }

  async updateAnomalyAction(id: string, status: string) {
    return this.request<{ message: string }>(`/api/anomalies/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async getForecast(horizon: '7D' | '30D' | '90D' = '30D'): Promise<MultiHorizonSpendingForecast> {
    return this.request<MultiHorizonSpendingForecast>(`/api/forecast?horizon=${horizon}`);
  }

  async simulateWhatIf(data: { scenarioName?: string; amount: number; category: string; isRecurring?: boolean }): Promise<WhatIfSimulationResult> {
    return this.request<WhatIfSimulationResult>('/api/what-if/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBudgetRecommendations(): Promise<{ recommendations: BudgetRecommendation[] }> {
    return this.request<{ recommendations: BudgetRecommendation[] }>('/api/ai/budget-recommendations');
  }

  async getGoalRecommendations(): Promise<{ recommendations: GoalRecommendation[] }> {
    return this.request<{ recommendations: GoalRecommendation[] }>('/api/ai/goal-recommendations');
  }

  async getAiTestSuite(): Promise<{ tests: AiTestCaseItem[]; summary: { total: number; passed: number; failed: number; executionTimestamp: string } }> {
    return this.request<{ tests: AiTestCaseItem[]; summary: { total: number; passed: number; failed: number; executionTimestamp: string } }>('/api/ai/test-suite');
  }

  async getRecurring(): Promise<RecurringTelemetry> {
    return this.request<RecurringTelemetry>('/api/recurring');
  }

  async sendChatMessage(message: string) {
    return this.request<{ reply: string; citations: string[]; source: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getBlockchainAudit() {
    return this.request<{
      telemetry: any;
      records: BlockchainRecord[];
      blocks: BlockchainBlock[];
    }>('/api/blockchain/audit');
  }

  async getBlockchainBlocks(page: number = 1, limit: number = 30) {
    return this.request<{
      blocks: BlockchainBlock[];
      pagination: { page: number; limit: number; totalCount: number; totalPages: number };
    }>(`/api/blockchain/blocks?page=${page}&limit=${limit}`);
  }

  async getBlockchainStatus(): Promise<{
    blockHeight: number;
    channelId: string;
    consensus: string;
    activeNodes: number;
    totalRecordsAnchored: number;
    lastBlockHash: string;
  }> {
    return this.request('/api/blockchain/status');
  }

  async auditBlockchain(): Promise<{
    isValid: boolean;
    blockCount: number;
    auditDetails: string[];
  }> {
    return this.request('/api/blockchain/verify-chain', { method: 'POST' });
  }

  async simulateTamper() {
    return this.request<{ message: string; tamperedTransactionId: string }>('/api/demo/simulate-tamper', {
      method: 'POST',
    });
  }

  async resetTamper() {
    return this.request<{ message: string }>('/api/demo/reset-tamper', { method: 'POST' });
  }

  async verifyTransaction(transactionId: string): Promise<VerificationResult> {
    return this.request<VerificationResult>('/api/blockchain/verify', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
  }

  async triggerTamperTest(transactionId: string, fakeAmount: number) {
    return this.request<{ message: string; transactionId: string; tamperedAmount: number }>('/api/blockchain/tamper-test', {
      method: 'POST',
      body: JSON.stringify({ transactionId, fakeAmount }),
    });
  }

  async getPrivacy() {
    return this.request<{ privacySettings: any }>('/api/privacy');
  }

  async updatePrivacy(data: any) {
    return this.request<{ message: string; privacySettings: any }>('/api/privacy', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getSecurity() {
    return this.request<{
      mfaEnabled: boolean;
      sessionTimeoutMinutes: number;
      activeSessionsCount: number;
      accountSecurity?: any;
    }>('/api/security/overview');
  }

  async getSecurityOverview() {
    return this.getSecurity();
  }

  async getSecurityLogs(): Promise<{ logs: any[] }> {
    return this.request<{ logs: any[] }>('/api/security/logs');
  }

  async resetDemoData() {
    return this.request<{ message: string }>('/api/demo/reset', { method: 'POST' });
  }

  async scanReceipt(data: { imageBase64?: string; text?: string; mimeType?: string }) {
    return this.request<any>('/api/receipt/scan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async parseVoice(transcript: string) {
    return this.request<any>('/api/voice/parse', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });
  }

  async getCashFlowForecast() {
    return this.request<any>('/api/cashflow/forecast');
  }

  async createRecurring(data: any) {
    return this.request<{ message: string; subscription: any }>('/api/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRecurringAction(id: string, status: string) {
    return this.request<{ message: string; subscription: any }>(`/api/recurring/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async getModelMetrics() {
    return this.request<any>('/api/ai/model-metrics');
  }

  async getSessions() {
    return this.request<{ sessions: any[] }>('/api/security/sessions');
  }

  async revokeSession(id: string) {
    return this.request<{ message: string }>(`/api/security/sessions/${id}`, { method: 'DELETE' });
  }

  async updateSessionTimeout(timeoutMinutes: number) {
    return this.request<{ message: string; timeoutMinutes: number }>('/api/security/session-timeout', {
      method: 'PATCH',
      body: JSON.stringify({ timeoutMinutes }),
    });
  }

  async setupMfa() {
    return this.request<{
      secret: string;
      otpAuthUrl: string;
      recoveryCodes: string[];
      qrCodeUri: string;
    }>('/api/security/mfa/setup', { method: 'POST' });
  }

  async verifyMfa(code: string, secret?: string, recoveryCodes?: string[]) {
    return this.request<{ success: boolean; mfaEnabled: boolean; message: string }>('/api/security/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code, secret, recoveryCodes }),
    });
  }

  async disableMfa(password: string) {
    return this.request<{ success: boolean; mfaEnabled: boolean; message: string }>('/api/security/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async exportBackup() {
    return this.request<{
      backupContainer: any;
      checksum: string;
      createdAt: string;
      message: string;
    }>('/api/security/backup/export', { method: 'POST' });
  }

  async validateBackup(backupContainer: any) {
    return this.request<{
      isValid: boolean;
      message?: string;
      error?: string;
      expectedChecksum?: string;
      computedChecksum?: string;
      metadata?: any;
    }>('/api/security/backup/validate', {
      method: 'POST',
      body: JSON.stringify({ backupContainer }),
    });
  }

  async restoreBackup(backupContainer: any, confirmOverwrite: boolean = true) {
    return this.request<{ message: string; restoredTransactionsCount: number }>('/api/security/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupContainer, confirmOverwrite }),
    });
  }

  async verifyBlock(blockNumber: number) {
    return this.request<{
      isValid: boolean;
      blockNumber: number;
      merkleRoot: string;
      recalculatedMerkleRoot: string;
      previousHash: string;
      expectedPreviousHash: string;
      transactionCount: number;
      recordsVerified: number;
      recordsFailed: number;
      details: string[];
    }>(`/api/blockchain/verify-block/${blockNumber}`);
  }

  async getMonthlyReport(month?: string) {
    return this.request<any>(`/api/reports/monthly${month ? `?month=${month}` : ''}`);
  }

  async exportUserData() {
    return this.request<any>('/api/export/data');
  }

  async getAccounts() {
    return this.request<{
      accounts: any[];
      totalAssets: number;
      totalLiabilities: number;
      netLiquidBalance: number;
      accountCount: number;
    }>('/api/accounts');
  }

  async createAccount(data: any) {
    return this.request<{ message: string; account: any }>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccount(id: string, data: any) {
    return this.request<{ message: string; account: any }>(`/api/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateAccountStatus(id: string, status: string) {
    return this.request<{ message: string; account: any }>(`/api/accounts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteAccount(id: string) {
    return this.request<{ message: string }>(`/api/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  async getAccountTransactions(id: string) {
    return this.request<{ transactions: any[]; count: number }>(`/api/accounts/${id}/transactions`);
  }

  async getSandboxProviders() {
    return this.request<{ disclaimer: string; providers: any[] }>('/api/sandbox/providers');
  }

  async connectSandbox(providerId: string) {
    return this.request<any>('/api/sandbox/connect', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    });
  }

  async syncSandbox(providerId: string) {
    return this.request<any>(`/api/sandbox/sync/${providerId}`);
  }

  async importSandboxTransactions(data: { accountId?: string; accountName?: string; transactions: any[] }) {
    return this.request<{ message: string; importedCount: number; transactions: any[]; isSyntheticDemo: boolean }>(
      '/api/sandbox/import',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async previewCSV(data: { csvContent: string; customMapping?: any }) {
    return this.request<any>('/api/import/csv-preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmCSVImport(data: { accountId?: string; rows: any[] }) {
    return this.request<{ message: string; importedCount: number; transactions: any[] }>('/api/import/csv-confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getReceipts() {
    return this.request<{
      receipts: any[];
      summary: { totalReceipts: number; needsReviewCount: number; linkedCount: number; unlinkedCount: number };
    }>('/api/receipts');
  }

  async uploadReceipt(data: { imageBase64?: string; text?: string; mimeType?: string; manualMerchant?: string; manualAmount?: number; manualCategory?: string }) {
    return this.request<{ message: string; receipt: any; needsReview: boolean }>('/api/receipts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getReceipt(id: string) {
    return this.request<{ receipt: any; linkedTransaction?: any }>(`/api/receipts/${id}`);
  }

  async updateReceipt(id: string, data: any) {
    return this.request<{ message: string; receipt: any }>(`/api/receipts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async linkReceipt(id: string, data: { transactionId?: string; createNewTransaction?: boolean; accountId?: string; paymentMethod?: string }) {
    return this.request<{ message: string; receipt: any; transaction: any }>(`/api/receipts/${id}/link`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unlinkReceipt(id: string) {
    return this.request<{ message: string; receipt: any }>(`/api/receipts/${id}/unlink`, {
      method: 'POST',
    });
  }

  async reprocessReceipt(id: string) {
    return this.request<{ message: string; receipt: any }>(`/api/receipts/${id}/reprocess`, {
      method: 'POST',
    });
  }

  async deleteReceipt(id: string) {
    return this.request<{ message: string }>(`/api/receipts/${id}`, {
      method: 'DELETE',
    });
  }

  async getBills() {
    return this.request<{
      bills: any[];
      summary: { totalBills: number; upcomingAmount: number; overdueCount: number; dueSoonCount: number; paidCount: number };
    }>('/api/bills');
  }

  async createBill(data: any) {
    return this.request<{ message: string; bill: any }>('/api/bills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBill(id: string, data: any) {
    return this.request<{ message: string; bill: any }>(`/api/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async payBill(id: string, data: { recordTransaction?: boolean; accountId?: string; paymentMethod?: string } = {}) {
    return this.request<{ message: string; bill: any; transaction?: any }>(`/api/bills/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteBill(id: string) {
    return this.request<{ message: string }>(`/api/bills/${id}`, {
      method: 'DELETE',
    });
  }

  async getSubscriptions() {
    return this.request<{
      subscriptions: any[];
      summary: {
        totalSubscriptions: number;
        activeCount: number;
        pausedCount: number;
        cancelledCount: number;
        totalMonthlyBurn: number;
        totalAnnualBurn: number;
        duplicateFlags: string[];
        priceChangeAlertsCount: number;
      };
    }>('/api/subscriptions');
  }

  async createSubscription(data: any) {
    return this.request<{ message: string; subscription: any }>('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubscription(id: string, data: any) {
    return this.request<{ message: string; subscription: any }>(`/api/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateSubscriptionStatus(id: string, status: string) {
    return this.request<{ message: string; subscription: any }>(`/api/subscriptions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteSubscription(id: string) {
    return this.request<{ message: string }>(`/api/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  async getLoans() {
    return this.request<{
      loans: any[];
      summary: {
        totalPrincipal: number;
        totalOutstanding: number;
        totalMonthlyEmi: number;
        weightedInterestRate: number;
        activeLoansCount: number;
        debtToIncomeRatio: number;
      };
    }>('/api/loans');
  }

  async createLoan(data: any) {
    return this.request<{ message: string; loan: any }>('/api/loans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLoan(id: string, data: any) {
    return this.request<{ message: string; loan: any }>(`/api/loans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async recordLoanPayment(id: string, data: { paymentAmount?: number; accountId?: string; paymentMethod?: string; notes?: string }) {
    return this.request<{ message: string; loan: any; transaction: any }>(`/api/loans/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteLoan(id: string) {
    return this.request<{ message: string }>(`/api/loans/${id}`, {
      method: 'DELETE',
    });
  }

  async downloadCalendarIcs(): Promise<void> {
    const token = localStorage.getItem('fintech_session_token');
    const res = await fetch('/api/calendar/export-ics', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      let errMessage = 'Failed to export calendar';
      try {
        const err = await res.json();
        if (err.error) errMessage = err.error;
      } catch { }
      throw new Error(errMessage);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis_finance_schedule_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async getKycStatus() {
    return this.request<{ status: string; kyc: any; message?: string }>('/api/kyc/status');
  }

  async submitKyc(data: {
    fullName: string;
    dateOfBirth?: string;
    address?: string;
    country?: string;
    documentType: string;
    documentNumber: string;
    documentImageUri?: string;
    ocrExtractedData?: any;
  }) {
    return this.request<{ message: string; status: string; kyc: any }>('/api/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reviewKyc(data: { decision: 'APPROVE' | 'REJECT'; reviewerNotes?: string; rejectionReason?: string }) {
    return this.request<{ message: string; status: string; kyc: any }>('/api/kyc/review', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resetKyc() {
    return this.request<{ message: string; status: string }>('/api/kyc/reset', {
      method: 'POST',
    });
  }

  async getHealth() {
    return this.request<{ status: string; environment: string; database: string; timestamp: string }>('/api/health');
  }

  async getExchangeRates(base: string = 'USD') {
    return this.request<{
      base: string;
      rates: Record<string, number>;
      timestamp: string;
      source: 'LIVE' | 'CACHED_BASELINE';
      attribution: string;
    }>(`/api/exchange-rates?base=${encodeURIComponent(base)}`);
  }

  async convertCurrency(amount: number, from: string, to: string) {
    return this.request<{
      from: string;
      to: string;
      amount: number;
      convertedAmount: number;
      rate: number;
      timestamp: string;
      source: 'LIVE' | 'CACHED_BASELINE';
      formattedResult: string;
    }>('/api/currency/convert', {
      method: 'POST',
      body: JSON.stringify({ amount, from, to }),
    });
  }
}

export const api = new ApiClient();

