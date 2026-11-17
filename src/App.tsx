import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DemoBanner } from './components/layout/DemoBanner';
import { DashboardView } from './components/dashboard/DashboardView';
import { AccountsView } from './components/accounts/AccountsView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { CalendarView } from './components/calendar/CalendarView';
import { BillsView } from './components/bills/BillsView';
import { SubscriptionsView } from './components/subscriptions/SubscriptionsView';
import { DebtTrackerView } from './components/debt/DebtTrackerView';
import { ReceiptsVaultView } from './components/receipts/ReceiptsVaultView';
import { StatementImportView } from './components/import/StatementImportView';
import { AiAssistantView } from './components/assistant/AiAssistantView';
import { BudgetsView } from './components/budgets/BudgetsView';
import { GoalsView } from './components/goals/GoalsView';
import { InsightsView } from './components/insights/InsightsView';
import { BlockchainAuditView } from './components/blockchain/BlockchainAuditView';
import { SecurityPrivacyView } from './components/security/SecurityPrivacyView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { KycView } from './components/kyc/KycView';
import { TermsOfServiceView } from './components/legal/TermsOfServiceView';
import { PrivacyPolicyView } from './components/legal/PrivacyPolicyView';
import { ProductWalkthrough } from './components/common/ProductWalkthrough';
import { LandingPage } from './components/landing/LandingPage';
import { AiAssistantDrawer } from './components/chat/AiAssistantDrawer';
import { VerifyModal } from './components/common/VerifyModal';
import { ExplainModal } from './components/common/ExplainModal';
import { AuthModal } from './components/auth/AuthModal';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { ReceiptScannerModal } from './components/transactions/ReceiptScannerModal';
import { VoiceExpenseModal } from './components/transactions/VoiceExpenseModal';
import { CommandMenu } from './components/common/CommandMenu';

const AppContent: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    isDemoMode,
    activeTab,
    setActiveTab,
    isReceiptModalOpen,
    setIsReceiptModalOpen,
    isVoiceModalOpen,
    setIsVoiceModalOpen,
    openAuthModal,
  } = useAuth();
  const [showLanding, setShowLanding] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider text-slate-400">INITIALIZING SECURE CLIENT SESSION...</span>
        </div>
      </div>
    );
  }

  if (activeTab === 'terms') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 flex flex-col justify-between">
        <TermsOfServiceView />
      </div>
    );
  }

  if (activeTab === 'privacy') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 flex flex-col justify-between">
        <PrivacyPolicyView />
      </div>
    );
  }

  if (!isAuthenticated || activeTab === 'landing' || showLanding) {
    return (
      <>
        <LandingPage
          onEnterApp={() => {
            if (isAuthenticated) {
              setActiveTab('dashboard');
            } else {
              openAuthModal?.('login');
            }
          }}
          onOpenTerms={() => setActiveTab('terms')}
          onOpenPrivacy={() => setActiveTab('privacy')}
        />
        <AuthModal />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'accounts':
        return <AccountsView />;
      case 'transactions':
        return <TransactionsView />;
      case 'calendar':
        return <CalendarView />;
      case 'bills':
        return <BillsView />;
      case 'subscriptions':
        return <SubscriptionsView />;
      case 'debt':
        return <DebtTrackerView />;
      case 'receipts':
        return <ReceiptsVaultView />;
      case 'import':
        return <StatementImportView />;
      case 'assistant':
        return <AiAssistantView />;
      case 'budgets':
        return <BudgetsView />;
      case 'goals':
        return <GoalsView />;
      case 'insights':
        return <InsightsView />;
      case 'blockchain':
        return <BlockchainAuditView />;
      case 'security':
        return <SecurityPrivacyView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'reports':
        return <ReportsView />;
      case 'kyc':
        return <KycView />;
      case 'settings':
        return <SettingsView />;
      case 'terms':
        return <TermsOfServiceView />;
      case 'privacy':
        return <PrivacyPolicyView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500/20 selection:text-indigo-900">
      {(isDemoMode || user?.id === 'usr-demo-fintech-01') && <DemoBanner />}

      <div className="flex-1 flex flex-col">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />

        <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

          <main className="flex-1 min-w-0">
            {renderActiveView()}
          </main>
        </div>

        <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 lg:px-8 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">CipherLedger</span>
              <span>•</span>
              <span>Zero-PII On-Chain Personal Finance Ledger</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsWalkthroughOpen(true)}
                className="text-slate-600 hover:text-slate-900 transition-colors font-medium cursor-pointer"
              >
                Guided Tour
              </button>
              <button
                onClick={() => setActiveTab('terms')}
                className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <button
                onClick={() => setActiveTab('privacy')}
                className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </footer>
      </div>

      <ProductWalkthrough isOpen={isWalkthroughOpen} onClose={() => setIsWalkthroughOpen(false)} />

      <AiAssistantDrawer />
      <VerifyModal />
      <ExplainModal />
      <AuthModal />
      <OnboardingModal />

      <ReceiptScannerModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onTransactionCreated={() => {
        }}
      />
      <VoiceExpenseModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onTransactionCreated={() => {
        }}
      />
      <CommandMenu />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
