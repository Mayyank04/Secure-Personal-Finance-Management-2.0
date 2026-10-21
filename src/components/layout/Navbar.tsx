import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Bell,
  Sparkles,
  User as UserIcon,
  LogOut,
  Settings,
  ChevronDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ExternalLink,
  Shield,
  Menu,
  Search,
  Camera,
  Mic,
  PlusCircle,
  Globe,
} from 'lucide-react';
import { useAuth, NavigationTab } from '../../context/AuthContext';
import { formatTime } from '../../lib/utils';
import { GlobalQuickActionMenu } from './GlobalQuickActionMenu';
import { CurrencyConverterModal } from '../currency/CurrencyConverterModal';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const {
    user,
    currency,
    setCurrency,
    activeTab,
    setActiveTab,
    notifications,
    unreadNotifsCount,
    markNotifAsRead,
    isChatOpen,
    setIsChatOpen,
    setIsReceiptModalOpen,
    setIsVoiceModalOpen,
    setIsAddTxModalOpen,
    setIsCommandMenuOpen,
    isCurrencyModalOpen,
    setIsCurrencyModalOpen,
    setIsAuthModalOpen,
    setAuthModalMode,
    logout,
  } = useAuth();

  const [showNotifs, setShowNotifs] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left Side: Mobile Menu Button & Brand */}
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-xs group-hover:bg-indigo-100 transition-all">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-indigo-600 transition-colors">
                  AegisFinance
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  AI + LEDGER
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block">Secure Personal Finance Management</p>
            </div>
          </button>
        </div>

        {/* Center: Command Menu & Search Bar */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setIsCommandMenuOpen(true)}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-100 border border-slate-200 text-xs text-slate-500 hover:text-slate-800 transition-all w-64 shadow-2xs"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="flex-1 text-left">Search or run command...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500 font-semibold shadow-2xs">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60 border border-slate-200/80 transition-colors"
              title="Scan Receipt (OCR)"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60 border border-slate-200/80 transition-colors"
              title="Voice Expense Entry"
            >
              <Mic className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60 border border-slate-200/80 transition-colors cursor-pointer"
                title="Global Quick Actions (+)"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
              <GlobalQuickActionMenu
                isOpen={showQuickActions}
                onClose={() => setShowQuickActions(false)}
                onOpenCurrencyModal={() => setIsCurrencyModalOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Currency Selector */}
          <div className="relative">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as any)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 pr-7 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* AI Financial Assistant Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isChatOpen
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">AI Financial Copilot</span>
            <span className="sm:hidden">AI</span>
          </button>

          {/* Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-800">Alerts & System Notifications</span>
                  </div>
                  {unreadNotifsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {unreadNotifsCount} new
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {(!notifications || notifications.length === 0) ? (
                    <div className="p-6 text-center text-xs text-slate-500">No active alerts.</div>
                  ) : (
                    (notifications || []).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotifAsRead(n.id);
                          if (n.actionUrl) {
                            setActiveTab(n.actionUrl as NavigationTab);
                            setShowNotifs(false);
                          }
                        }}
                        className={`p-3.5 text-left transition-colors cursor-pointer hover:bg-slate-50 flex items-start gap-3 ${
                          !n.isRead ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <div className="mt-0.5">
                          {n.type === 'UNUSUAL_SPENDING' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : n.type === 'BLOCKCHAIN_VERIFICATION' ? (
                            <Lock className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-semibold text-slate-800 truncate">{n.title}</h5>
                            <span className="text-[10px] text-slate-400">{formatTime(n.timestamp)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-slate-200 bg-slate-50 text-center">
                  <button
                    onClick={() => {
                      setActiveTab('insights');
                      setShowNotifs(false);
                    }}
                    className="text-[11px] font-medium text-indigo-600 hover:underline"
                  >
                    View All AI Intelligence Reports →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Account Menu */}
          <div className="relative" ref={userMenuRef}>
            {user ? (
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-slate-800">{user.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">TLS 1.3 Active</div>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('signup');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs"
                >
                  Register
                </button>
              </div>
            )}

            {/* User Dropdown */}
            {showUserMenu && user && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                <div className="p-3 border-b border-slate-100 mb-1">
                  <p className="text-xs font-semibold text-slate-800">{user.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                      MFA: {user.mfaEnabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                      ROLE: {user.role}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5 text-xs">
                  <button
                    onClick={() => {
                      setActiveTab('security');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-left"
                  >
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>Security & MFA Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('blockchain');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-left"
                  >
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Blockchain Ledger Status</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Preferences & Privacy</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors text-left text-xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Currency Converter Modal */}
      <CurrencyConverterModal
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        defaultCurrency={currency}
      />
    </header>
  );
};
