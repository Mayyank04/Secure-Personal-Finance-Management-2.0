/**
 * Production Currency & Foreign Exchange (FX) Service
 * 
 * Provides:
 * - Real-time and cached multi-currency conversion
 * - Baseline reference rates (INR, USD, EUR, GBP, JPY, CAD, AUD, SGD, AED, CHF)
 * - Input sanitization, validation, and zero/negative guards
 * - Transparent source tagging (LIVE vs CACHED_BASELINE)
 */

export interface ExchangeRatesData {
  base: string;
  rates: Record<string, number>;
  timestamp: string;
  source: 'LIVE' | 'CACHED_BASELINE';
  attribution: string;
}

export interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  timestamp: string;
  source: 'LIVE' | 'CACHED_BASELINE';
  formattedResult: string;
}

// Deterministic baseline exchange rates relative to 1 USD (August 2026 Reference)
const BASELINE_USD_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 86.45,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 154.2,
  CAD: 1.36,
  AUD: 1.52,
  SGD: 1.33,
  AED: 3.67,
  CHF: 0.88,
  CNY: 7.24,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  SGD: 'S$',
  AED: 'د.إ',
  CHF: 'CHF',
  CNY: '¥',
};

// In-memory cache for FX rates
let cachedRates: ExchangeRatesData | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export class CurrencyService {
  /**
   * Fetch current exchange rates with fallback to cached baseline
   */
  public async getRates(base: string = 'USD'): Promise<ExchangeRatesData> {
    const normalizedBase = base.toUpperCase();
    const now = Date.now();

    if (cachedRates && (now - lastFetchTime < CACHE_TTL_MS)) {
      return this.rebaseRates(cachedRates, normalizedBase);
    }

    try {
      // Attempt live fetch from reliable free FX endpoint (open.er-api.com)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`https://open.er-api.com/v6/latest/USD`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.rates) {
          cachedRates = {
            base: 'USD',
            rates: {
              ...BASELINE_USD_RATES,
              ...data.rates,
            },
            timestamp: new Date().toISOString(),
            source: 'LIVE',
            attribution: 'Live Open Exchange Rates API',
          };
          lastFetchTime = now;
          return this.rebaseRates(cachedRates, normalizedBase);
        }
      }
    } catch {
      // Fallback gracefully to cached baseline
    }

    // Return deterministic cached baseline rates
    const baselineData: ExchangeRatesData = {
      base: 'USD',
      rates: { ...BASELINE_USD_RATES },
      timestamp: new Date().toISOString(),
      source: 'CACHED_BASELINE',
      attribution: 'AegisFinance Cached Baseline (August 2026 Reference)',
    };
    cachedRates = baselineData;
    lastFetchTime = now;
    return this.rebaseRates(baselineData, normalizedBase);
  }

  /**
   * Rebase a rates object from USD to a target base currency
   */
  private rebaseRates(ratesData: ExchangeRatesData, newBase: string): ExchangeRatesData {
    if (newBase === 'USD') return ratesData;

    const baseRateInUsd = ratesData.rates[newBase] || 1;
    const rebasedRates: Record<string, number> = {};

    for (const [curr, rateInUsd] of Object.entries(ratesData.rates)) {
      rebasedRates[curr] = Math.round((rateInUsd / baseRateInUsd) * 100000) / 100000;
    }

    return {
      base: newBase,
      rates: rebasedRates,
      timestamp: ratesData.timestamp,
      source: ratesData.source,
      attribution: ratesData.attribution,
    };
  }

  /**
   * Convert an amount from one currency to another
   */
  public async convert(
    amountInput: number | string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ConversionResult> {
    const from = (fromCurrency || 'INR').toUpperCase().trim();
    const to = (toCurrency || 'USD').toUpperCase().trim();

    const numAmount = typeof amountInput === 'string' ? parseFloat(amountInput) : amountInput;

    if (isNaN(numAmount) || !isFinite(numAmount)) {
      throw new Error('Invalid amount: Please provide a valid numeric value.');
    }

    if (numAmount < 0) {
      throw new Error('Amount cannot be negative.');
    }

    const ratesData = await this.getRates('USD');
    const fromRateToUsd = ratesData.rates[from];
    const toRateToUsd = ratesData.rates[to];

    if (!fromRateToUsd) {
      throw new Error(`Unsupported source currency: "${from}".`);
    }
    if (!toRateToUsd) {
      throw new Error(`Unsupported target currency: "${to}".`);
    }

    // Direct 1:1 if same currency
    if (from === to) {
      const symbol = CURRENCY_SYMBOLS[to] || '';
      return {
        from,
        to,
        amount: numAmount,
        convertedAmount: numAmount,
        rate: 1.0,
        timestamp: ratesData.timestamp,
        source: ratesData.source,
        formattedResult: `${symbol}${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${to}`,
      };
    }

    // Cross-rate calculation via USD base
    const conversionFactor = toRateToUsd / fromRateToUsd;
    const rawConverted = numAmount * conversionFactor;
    const convertedAmount = Math.round(rawConverted * 100) / 100;
    const effectiveRate = Math.round(conversionFactor * 10000) / 10000;

    const symbol = CURRENCY_SYMBOLS[to] || '';
    const formatted = `${symbol}${convertedAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${to}`;

    return {
      from,
      to,
      amount: numAmount,
      convertedAmount,
      rate: effectiveRate,
      timestamp: ratesData.timestamp,
      source: ratesData.source,
      formattedResult: formatted,
    };
  }
}

export const currencyService = new CurrencyService();
