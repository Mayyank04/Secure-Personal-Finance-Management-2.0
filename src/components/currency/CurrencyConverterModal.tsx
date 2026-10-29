import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  Copy,
  Check,
  Globe,
  Info,
  Clock,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';

interface CurrencyConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCurrency?: string;
}

const DEFAULT_RATES: Record<string, { rate: number; symbol: string; name: string }> = {
  USD: { rate: 1.0, symbol: '$', name: 'US Dollar' },
  INR: { rate: 86.45, symbol: '₹', name: 'Indian Rupee' },
  EUR: { rate: 0.92, symbol: '€', name: 'Euro' },
  GBP: { rate: 0.79, symbol: '£', name: 'British Pound' },
  JPY: { rate: 154.2, symbol: '¥', name: 'Japanese Yen' },
  CAD: { rate: 1.36, symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { rate: 1.52, symbol: 'A$', name: 'Australian Dollar' },
  SGD: { rate: 1.33, symbol: 'S$', name: 'Singapore Dollar' },
  AED: { rate: 3.67, symbol: 'د.إ', name: 'UAE Dirham' },
  CHF: { rate: 0.88, symbol: 'CHF', name: 'Swiss Franc' },
  CNY: { rate: 7.24, symbol: '¥', name: 'Chinese Yuan' },
};

export const CurrencyConverterModal: React.FC<CurrencyConverterModalProps> = ({
  isOpen,
  onClose,
  defaultCurrency = 'INR',
}) => {
  const [fromCurrency, setFromCurrency] = useState<string>(defaultCurrency);
  const [toCurrency, setToCurrency] = useState<string>(defaultCurrency === 'USD' ? 'INR' : 'USD');
  const [amount, setAmount] = useState<string>('1000');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [ratesSource, setRatesSource] = useState<'LIVE' | 'CACHED_BASELINE'>('CACHED_BASELINE');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchRates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getExchangeRates('USD');
      if (data && data.rates) {
        setRatesMap(data.rates);
        setRatesSource(data.source || 'CACHED_BASELINE');
        setLastUpdated(data.timestamp || new Date().toISOString());
      }
    } catch {
      const fallback: Record<string, number> = {};
      Object.entries(DEFAULT_RATES).forEach(([k, v]) => {
        fallback[k] = v.rate;
      });
      setRatesMap(fallback);
      setRatesSource('CACHED_BASELINE');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (defaultCurrency && DEFAULT_RATES[defaultCurrency]) {
        setFromCurrency(defaultCurrency);
        setToCurrency(defaultCurrency === 'USD' ? 'INR' : 'USD');
      }
      fetchRates();
    }
  }, [isOpen, defaultCurrency]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount);
  const isInvalidAmount = amount !== '' && (isNaN(numAmount) || numAmount < 0);
  const isZero = amount !== '' && numAmount === 0;

  const fromRate = ratesMap[fromCurrency] || DEFAULT_RATES[fromCurrency]?.rate || 1;
  const toRate = ratesMap[toCurrency] || DEFAULT_RATES[toCurrency]?.rate || 1;
  const conversionFactor = fromRate > 0 ? toRate / fromRate : 1;

  let convertedAmount = 0;
  if (!isNaN(numAmount) && numAmount >= 0) {
    convertedAmount = Math.round(numAmount * conversionFactor * 100) / 100;
  }

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const handleCopy = () => {
    const symbol = DEFAULT_RATES[toCurrency]?.symbol || '';
    const formatted = `${symbol}${convertedAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${toCurrency}`;
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Currency Converter
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                    ratesSource === 'LIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  {ratesSource === 'LIVE' ? 'LIVE FX' : 'CACHED BASELINE'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">Live & Cached Multi-Currency Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">Amount to Convert</label>
              {isInvalidAmount && (
                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-0.5">
                  <AlertCircle className="w-3 h-3" /> Amount cannot be negative
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                {DEFAULT_RATES[fromCurrency]?.symbol || '$'}
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:bg-white transition-all shadow-2xs ${
                  isInvalidAmount
                    ? 'border-rose-300 focus:border-rose-500'
                    : 'border-slate-200 focus:border-indigo-500'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[100, 500, 1000, 5000, 10000].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val.toString())}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  numAmount === val
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                +{val.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-7 items-center gap-2">
            <div className="col-span-3 space-y-1">
              <label className="text-[11px] font-semibold text-slate-500">From</label>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                {Object.entries(DEFAULT_RATES).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {code} ({meta.symbol}) - {meta.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-1 flex justify-center pt-5">
              <button
                onClick={handleSwap}
                className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                title="Swap Currencies"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="col-span-3 space-y-1">
              <label className="text-[11px] font-semibold text-slate-500">To</label>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                {Object.entries(DEFAULT_RATES).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {code} ({meta.symbol}) - {meta.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-indigo-700 font-semibold">
              <span>Converted Estimate</span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                <Clock className="w-3 h-3 text-indigo-500" />
                1 {fromCurrency} = {conversionFactor.toFixed(4)} {toCurrency}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {DEFAULT_RATES[toCurrency]?.symbol || ''}
                {isInvalidAmount
                  ? '---'
                  : convertedAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                <span className="text-sm font-bold text-indigo-600">{toCurrency}</span>
              </div>

              <button
                onClick={handleCopy}
                disabled={isInvalidAmount}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p>
                {ratesSource === 'LIVE'
                  ? `Live FX feed active. Rates updated: ${new Date(lastUpdated).toLocaleTimeString()}.`
                  : `Cached Baseline (August 2026 Reference). Conversions are computed for estimation without altering your account ledger currency.`}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={fetchRates}
            disabled={isLoading}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Updating...' : 'Refresh Rates'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
