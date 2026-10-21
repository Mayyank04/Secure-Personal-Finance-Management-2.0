/**
 * Dedicated Full-Screen AI Financial Assistant & Copilot View
 * Features:
 * - Direct conversational query engine with real-time financial context grounding
 * - Multi-category suggested prompts (Spending, Anomalies, Budgets, Goals, Subscriptions, Forecasts)
 * - Evidence citations linking to cryptographic ledger states
 * - Export transcript capability
 * - Clear AI / XAI regulatory and audit disclaimers
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CornerDownRight,
  Download,
  Trash2,
  Lock,
  Layers,
  ArrowRight,
  BrainCircuit,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: string[];
  source?: string;
  timestamp: string;
}

const PROMPT_CATEGORIES = [
  {
    category: 'Spending & Habits',
    prompts: [
      'How much did I spend on Food and Groceries this month?',
      'What are my top 3 largest expenses in August 2026?',
      'How does my discretionary spending compare to last month?',
    ],
  },
  {
    category: 'Anomalies & Security',
    prompts: [
      'Are there any flagged unusual expenses requiring my review?',
      'Show me transactions that deviated from my historical baseline.',
      'Check if any duplicate charges were detected recently.',
    ],
  },
  {
    category: 'Budgets & Goals',
    prompts: [
      'Which budget categories are at risk of exceeding limits?',
      'Will I achieve my Emergency Fund goal by December at current rate?',
      'Can I afford a ₹12,000 purchase without breaking my monthly budget?',
    ],
  },
  {
    category: 'Cash Flow & Recurring',
    prompts: [
      'What is my projected end-of-month cash flow balance?',
      'List all active subscriptions and their upcoming renewal dates.',
      'How much fixed recurring expenses do I pay every month?',
    ],
  },
];

export const AiAssistantView: React.FC = () => {
  const { currency, profile, user } = useAuth();
  const c = currency === 'INR' ? '₹' : '$';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: `Hello ${user?.name?.split(' ')[0] || 'Alex'}! I am your AI Financial Copilot. I have audited your private transactions, category budgets, and active savings goals for August 2026.\n\nEvery insight I provide is strictly grounded on your verified records and encrypted database state. How can I assist with your financial planning or anomaly analysis today?`,
      citations: ['Private Encrypted Ledger', 'Live August 2026 Budget Context', 'Anomaly Detection Model'],
      source: 'LOCAL_GROUNDED_ENGINE',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputValue;
    if (!query.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsSending(true);

    try {
      const res = await api.sendChatMessage(query.trim());
      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        sender: 'assistant',
        text: res.reply,
        citations: res.citations,
        source: res.source,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'assistant',
        text: 'I could not complete analysis with the private database engine. Please check your data permissions in Security settings.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Chat history cleared. How can I assist with your financial analytics, budget forecasts, or transaction records?`,
        citations: ['Private Database State'],
        source: 'LOCAL_GROUNDED_ENGINE',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleExportTranscript = () => {
    const textContent = messages
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender.toUpperCase()}:\n${m.text}\n${
            m.citations && m.citations.length > 0 ? `Citations: ${m.citations.join('; ')}\n` : ''
          }\n----------------------------------------\n`
      )
      .join('\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-financial-copilot-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">AI Financial Assistant</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Grounded XAI Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Query your verified spending records, anomaly reports, cash flow forecasts, and budget limits in natural language.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportTranscript}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Transcript
          </button>
          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            Clear
          </button>
        </div>
      </div>

      {/* Main Chat Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Feed Column (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
          {/* Feed Header */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-900">Active Copilot Session</span>
                <span className="text-[11px] text-slate-400 ml-2">Zero Data Hallucination Guardrails</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium">
              <ShieldCheck className="w-3 h-3" />
              <span>Grounding Active</span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Citations & Evidence Pill List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <FileCheck2 className="w-3 h-3 text-indigo-500" />
                        <span>Verified Citations & Ledger Grounding</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cite, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-700 font-medium shadow-xs"
                          >
                            {cite}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-2 text-[10px] ${
                      msg.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <User className="w-4.5 h-4.5" />
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3 justify-start items-center text-xs text-slate-500 py-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Bot className="w-4.5 h-4.5 animate-bounce" />
                </div>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Auditing private records & generating grounded response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about spending breakdown, unusual expenses, budget limits, or savings forecast..."
                disabled={isSending}
                className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !inputValue.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Suggested Prompts & Privacy Controls Column (1 col) */}
        <div className="space-y-4">
          {/* Quick Prompts Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Suggested Financial Prompts
              </h3>
            </div>

            <div className="space-y-4">
              {PROMPT_CATEGORIES.map((cat, idx) => (
                <div key={idx}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                    {cat.category}
                  </p>
                  <div className="space-y-1.5">
                    {cat.prompts.map((p, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() => handleSend(p)}
                        className="w-full text-left p-2 rounded-xl text-[11px] text-slate-700 bg-slate-50 hover:bg-indigo-50/50 hover:text-indigo-700 border border-slate-200/60 hover:border-indigo-200 transition-all flex items-center justify-between group"
                      >
                        <span className="line-clamp-2">{p}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 shrink-0 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Grounding & Privacy Notice */}
          <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Grounded Financial Intelligence</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              The AI Financial Copilot strictly references your local ledger records, category budgets, and savings goals. Raw account numbers and credentials never leave your secure container environment.
            </p>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>SHA-256 Verified Records</span>
              <span>Explainable AI (XAI)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
