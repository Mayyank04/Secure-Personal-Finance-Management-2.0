
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile, NotificationItem, Transaction } from '../types';
import { api } from '../lib/api';

export type NavigationTab =
  | 'landing'
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'calendar'
  | 'bills'
  | 'subscriptions'
  | 'debt'
  | 'receipts'
  | 'import'
  | 'assistant'
  | 'budgets'
  | 'goals'
  | 'insights'
  | 'analytics'
  | 'blockchain'
  | 'security'
  | 'reports'
  | 'kyc'
  | 'settings';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  currency: string;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  setCurrency: (c: 'INR' | 'USD' | 'EUR' | 'GBP') => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  setIsDemoMode: (demo: boolean) => void;
  login: (data: { email: string; password: string }) => Promise<{ mfaRequired?: boolean; mfaTicket?: string } | void>;
  completeMfa: (data: { mfaTicket: string; code: string }) => Promise<void>;
  enterDemoMode: () => Promise<void>;
  register: (data: { name: string; email: string; password: string; currency?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetDemoDataset: () => Promise<void>;
  notifications: NotificationItem[];
  unreadNotifsCount: number;
  markNotifAsRead: (id: string) => void;
  markAllNotifsAsRead: () => void;
  isMfaActive: boolean;
  setIsMfaActive: (active: boolean) => void;
  isMfaEnabled?: boolean;
  setIsMfaEnabled?: (active: boolean) => void;
  isTampered?: boolean;
  setIsTampered?: (tampered: boolean) => void;
  refreshBlockchainStatus?: () => Promise<void>;
  openAuthModal?: (mode?: 'login' | 'signup' | 'forgot' | 'LOGIN' | 'SIGNUP') => void;
  verifyTxModalData: Transaction | null;
  openVerifyModal: (tx: Transaction) => void;
  closeVerifyModal: () => void;
  explainModalData: { title: string; explanation: string; signals: string[]; action?: string } | null;
  openExplainModal: (data: { title: string; explanation: string; signals: string[]; action?: string }) => void;
  closeExplainModal: () => void;
  isReceiptModalOpen: boolean;
  setIsReceiptModalOpen: (open: boolean) => void;
  isVoiceModalOpen: boolean;
  setIsVoiceModalOpen: (open: boolean) => void;
  isAddTxModalOpen: boolean;
  setIsAddTxModalOpen: (open: boolean) => void;
  isCommandMenuOpen: boolean;
  setIsCommandMenuOpen: (open: boolean) => void;
  isCurrencyModalOpen: boolean;
  setIsCurrencyModalOpen: (open: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'signup' | 'forgot';
  setAuthModalMode: (mode: 'login' | 'signup' | 'forgot') => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currency, setCurrencyState] = useState<string>('INR');
  const [activeTab, setActiveTab] = useState<NavigationTab>('landing');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isMfaActive, setIsMfaActive] = useState<boolean>(false);
  const [isTampered, setIsTampered] = useState<boolean>(false);

  const [verifyTxModalData, setVerifyTxModalData] = useState<Transaction | null>(null);
  const [explainModalData, setExplainModalData] = useState<{ title: string; explanation: string; signals: string[]; action?: string } | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState<boolean>(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState<boolean>(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = async () => {
    try {
      const res = await api.getNotifications();
      if (res?.notifications) {
        setNotifications(res.notifications);
      }
    } catch {
      // ignore
    }
  };

  const loadUserData = async () => {
    const token = localStorage.getItem('fintech_session_token');
    if (!token) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await api.getMe();
      if (data.user) {
        setUser(data.user);
        setProfile(data.profile);
        setIsMfaActive(data.user.mfaEnabled);
        if (data.profile?.preferredCurrency) {
          setCurrencyState(data.profile.preferredCurrency);
        }
        if (activeTab === 'landing') {
          setActiveTab('dashboard');
        }
        await loadNotifications();
      }
    } catch (err: any) {
      if (err?.status === 401) {
        localStorage.removeItem('fintech_session_token');
        setUser(null);
        setProfile(null);
        setActiveTab('landing');
      } else {
        console.warn('[AuthContext] Transient/database error during session load:', err?.message || err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();

    const handleUnauthorized = () => {
      localStorage.removeItem('fintech_session_token');
      setUser(null);
      setProfile(null);
      setIsDemoMode(false);
      setNotifications([]);
      setActiveTab('landing');
    };

    window.addEventListener('fintech_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('fintech_unauthorized', handleUnauthorized);
  }, []);

  const login = async (data: { email: string; password: string }) => {
    const res = await api.login(data);
    if (res.mfaRequired && res.mfaTicket) {
      return { mfaRequired: true, mfaTicket: res.mfaTicket };
    }

    if (res.token) {
      localStorage.setItem('fintech_session_token', res.token);
      setUser(res.user);
      setProfile(res.profile);
      setIsMfaActive(res.user?.mfaEnabled || false);
      if (res.profile?.preferredCurrency) setCurrencyState(res.profile.preferredCurrency);
      setIsAuthModalOpen(false);
      setActiveTab('dashboard');
      await loadNotifications();
    }
  };

  const completeMfa = async (data: { mfaTicket: string; code: string }) => {
    const res = await api.mfaChallenge(data);
    if (res.token) {
      localStorage.setItem('fintech_session_token', res.token);
      setUser(res.user);
      setProfile(res.profile);
      setIsMfaActive(res.user?.mfaEnabled || false);
      if (res.profile?.preferredCurrency) setCurrencyState(res.profile.preferredCurrency);
      setIsAuthModalOpen(false);
      setActiveTab('dashboard');
      await loadNotifications();
    }
  };

  const enterDemoMode = async () => {
    try {
      setIsLoading(true);
      const res = await api.demoSession();
      localStorage.setItem('fintech_session_token', res.token);
      setUser(res.user);
      setProfile(res.profile);
      setIsDemoMode(true);
      setIsMfaActive(res.user?.mfaEnabled || false);
      if (res.profile?.preferredCurrency) setCurrencyState(res.profile.preferredCurrency);
      setActiveTab('dashboard');
      await loadNotifications();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; password: string; currency?: string }) => {
    const res = await api.register(data);
    localStorage.setItem('fintech_session_token', res.token);
    setUser(res.user);
    setProfile(res.profile);
    if (res.profile?.preferredCurrency) setCurrencyState(res.profile.preferredCurrency);
    setIsAuthModalOpen(false);
    setIsOnboardingOpen(true);
    setActiveTab('dashboard');
    await loadNotifications();
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
    }
    localStorage.removeItem('fintech_session_token');
    setUser(null);
    setProfile(null);
    setIsDemoMode(false);
    setNotifications([]);
    setIsAuthModalOpen(false);
    setIsOnboardingOpen(false);
    setIsChatOpen(false);
    setIsReceiptModalOpen(false);
    setIsVoiceModalOpen(false);
    setIsAddTxModalOpen(false);
    setIsCommandMenuOpen(false);
    setActiveTab('landing');
  };

  const refreshProfile = async () => {
    try {
      const data = await api.getMe();
      if (data.user) {
        setUser(data.user);
        setProfile(data.profile);
        setIsMfaActive(data.user.mfaEnabled);
        if (data.profile?.preferredCurrency) setCurrencyState(data.profile.preferredCurrency);
      }
    } catch {
      // ignore
    }
  };

  const resetDemoDataset = async () => {
    try {
      await api.resetDemoData();
      await loadUserData();
    } catch (e) {
      console.error(e);
    }
  };

  const setCurrency = (c: 'INR' | 'USD' | 'EUR' | 'GBP') => {
    setCurrencyState(c);
    if (profile) {
      setProfile({ ...profile, preferredCurrency: c });
      api.saveOnboarding({ preferredCurrency: c }).catch(() => {});
    }
  };

  const markNotifAsRead = async (id: string) => {
    setNotifications(prev => (prev || []).map(n => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch {
      // ignore
    }
  };

  const markAllNotifsAsRead = async () => {
    setNotifications(prev => (prev || []).map(n => ({ ...n, isRead: true })));
    try {
      await api.markAllNotificationsRead();
    } catch {
      // ignore
    }
  };

  const unreadNotifsCount = (notifications || []).filter(n => !n.isRead).length;

  const openAuthModal = (mode: 'login' | 'signup' | 'forgot' | 'LOGIN' | 'SIGNUP' = 'login') => {
    const normalized = mode.toLowerCase() as 'login' | 'signup' | 'forgot';
    setAuthModalMode(normalized);
    setIsAuthModalOpen(true);
  };

  const refreshBlockchainStatus = async () => {
    try {
      await api.getBlockchainStatus();
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        currency,
        activeTab,
        setActiveTab,
        setCurrency,
        isLoading,
        isAuthenticated: !!user,
        isDemoMode,
        setIsDemoMode,
        login,
        completeMfa,
        enterDemoMode,
        register,
        logout,
        refreshProfile,
        resetDemoDataset,
        notifications: notifications || [],
        unreadNotifsCount,
        markNotifAsRead,
        markAllNotifsAsRead,
        isMfaActive,
        setIsMfaActive,
        isMfaEnabled: isMfaActive,
        setIsMfaEnabled: setIsMfaActive,
        isTampered,
        setIsTampered,
        refreshBlockchainStatus,
        openAuthModal,
        verifyTxModalData,
        openVerifyModal: (tx: Transaction) => setVerifyTxModalData(tx),
        closeVerifyModal: () => setVerifyTxModalData(null),
        explainModalData,
        openExplainModal: data => setExplainModalData(data),
        closeExplainModal: () => setExplainModalData(null),
        isReceiptModalOpen,
        setIsReceiptModalOpen,
        isVoiceModalOpen,
        setIsVoiceModalOpen,
        isAddTxModalOpen,
        setIsAddTxModalOpen,
        isCommandMenuOpen,
        setIsCommandMenuOpen,
        isCurrencyModalOpen,
        setIsCurrencyModalOpen,
        isChatOpen,
        setIsChatOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        isOnboardingOpen,
        setIsOnboardingOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
