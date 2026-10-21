/**
 * Zero-Cost Local Deterministic Receipt Parser
 * 
 * Extracts structured financial fields (Merchant, Date, Total, Tax, Currency, Line Items, Category, Payment Method)
 * completely locally using deterministic regex and pattern heuristics on raw OCR text.
 * No external API, no paid services, 100% private.
 */

import { TransactionCategory, PaymentMethod, ReceiptItem } from '../../types';

export interface ParsedReceiptData {
  merchant: string;
  date: string;
  totalAmount: number;
  taxAmount: number;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP' | string;
  currencySymbol: string;
  category: TransactionCategory;
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
  confidence: number;
  isLowConfidence: boolean;
  notes: string;
  rawText: string;
  warnings: string[];
}

// Common generic words that should NOT be treated as merchant names
const GENERIC_HEADER_TERMS = [
  'tax invoice',
  'invoice',
  'receipt',
  'cash memo',
  'bill of supply',
  'retail invoice',
  'payment receipt',
  'store receipt',
  'customer copy',
  'merchant copy',
  'original for recipient',
  'duplicate for supplier',
  'order receipt',
  'pos transaction',
  'welcome to',
  'thank you',
  'welcome',
  'gstin',
  'gst no',
  'tin no',
  'vat no',
  'tel:',
  'phone:',
  'email:',
  'date:',
  'time:',
  'table #',
  'order #',
  'bill no',
  'token #',
  'cashier:',
  'terminal:',
];

export function parseReceiptText(rawText: string, preferredCurrency: string = 'INR'): ParsedReceiptData {
  const warnings: string[] = [];
  const text = (rawText || '').trim();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      merchant: '',
      date: new Date().toISOString().split('T')[0],
      totalAmount: 0,
      taxAmount: 0,
      currency: preferredCurrency,
      currencySymbol: preferredCurrency === 'INR' ? '₹' : '$',
      category: 'Shopping',
      paymentMethod: 'Credit Card',
      items: [],
      confidence: 10,
      isLowConfidence: true,
      notes: 'No text extracted from receipt.',
      rawText: '',
      warnings: ['No legible text was found in the image. Please enter receipt details manually.'],
    };
  }

  // 1. Detect Currency
  let detectedCurrency = preferredCurrency;
  let currencySymbol = preferredCurrency === 'INR' ? '₹' : '$';

  if (/(?:₹|inr|rs\.?|rupees)/i.test(text)) {
    detectedCurrency = 'INR';
    currencySymbol = '₹';
  } else if (/(?:\$|usd|dollars)/i.test(text)) {
    detectedCurrency = 'USD';
    currencySymbol = '$';
  } else if (/(?:€|eur|euros)/i.test(text)) {
    detectedCurrency = 'EUR';
    currencySymbol = '€';
  } else if (/(?:£|gbp|pounds)/i.test(text)) {
    detectedCurrency = 'GBP';
    currencySymbol = '£';
  }

  // 2. Extract Merchant Name
  let merchant = '';
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check if line is purely symbols, dates, numbers, or generic headers
    if (/^[=\-_*#.~:/\s\d]+$/.test(line)) continue;
    if (line.length < 3) continue;

    const isGeneric = GENERIC_HEADER_TERMS.some((term) => lower.startsWith(term) || lower === term);
    if (isGeneric) continue;

    // Remove leading "Welcome to" if present
    const cleaned = line.replace(/^(?:welcome\s+to|store\s*#?\d*:?)\s*/i, '').replace(/[^\w\s&',.-]/g, '').trim();
    if (cleaned.length >= 3 && !/^(date|time|gstin|phone|tel|email|fax)/i.test(cleaned)) {
      merchant = cleaned;
      break;
    }
  }

  if (!merchant && lines.length > 0) {
    merchant = lines[0].replace(/[^\w\s&',.-]/g, '').trim() || 'Store / Merchant';
    warnings.push('Merchant name could not be reliably identified.');
  }

  // 3. Extract Date
  let date = '';
  const datePatterns = [
    // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    /\b(20\d\d)[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/,
    // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d\d)\b/,
    // MM-DD-YYYY or MM/DD/YYYY
    /\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d\d)\b/,
    // DD Mon YYYY (e.g. 18 Aug 2026, 18-Aug-2026)
    /\b(0?[1-9]|[12]\d|3[01])[\s-](Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,-]+(20\d\d)\b/i,
    // Mon DD, YYYY (e.g. Aug 18, 2026)
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s.-]+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?[\s,-]+(20\d\d)\b/i,
  ];

  const monthMap: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        if (pattern === datePatterns[0]) {
          // YYYY-MM-DD
          date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else if (pattern === datePatterns[1]) {
          // DD-MM-YYYY
          date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        } else if (pattern === datePatterns[2]) {
          // MM-DD-YYYY
          date = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        } else if (pattern === datePatterns[3]) {
          // DD Mon YYYY
          const m = monthMap[match[2].toLowerCase()] || '01';
          date = `${match[3]}-${m}-${match[1].padStart(2, '0')}`;
        } else if (pattern === datePatterns[4]) {
          // Mon DD, YYYY
          const m = monthMap[match[1].toLowerCase()] || '01';
          date = `${match[3]}-${m}-${match[2].padStart(2, '0')}`;
        }
        if (date) break;
      }
    }
    if (date) break;
  }

  if (!date) {
    date = new Date().toISOString().split('T')[0];
    warnings.push('Date could not be detected. Defaulted to today.');
  }

  // 4. Extract Total Amount
  let totalAmount = 0;
  const totalKeywordsRegex = /(?:grand\s*total|total\s*amount|total\s*due|total\s*fare|net\s*payable|amount\s*due|amount\s*paid|balance\s*due|charge|total)\s*[:=\-]?\s*(?:[^\d\n]*)\s*([\d,]+\.?\d*)/i;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(totalKeywordsRegex);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/,/g, '');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed) && parsed > 0) {
        totalAmount = parsed;
        break;
      }
    }
  }

  // Fallback: If no explicit keyword, find the maximum numeric currency value in the bottom half of receipt
  if (totalAmount <= 0) {
    const bottomLines = lines.slice(Math.floor(lines.length * 0.35));
    let maxVal = 0;
    for (const line of bottomLines) {
      if (/subtotal|tax|gst|vat|change|cash|qty/i.test(line)) continue;
      const numMatches = line.match(/(?:[₹$€£]|rs\.?|inr)?\s*([\d,]+\.\d{2})/gi);
      if (numMatches) {
        for (const numStr of numMatches) {
          const val = parseFloat(numStr.replace(/[^\d.]/g, ''));
          if (!isNaN(val) && val > maxVal && val < 500000) {
            maxVal = val;
          }
        }
      }
    }
    if (maxVal > 0) {
      totalAmount = maxVal;
      warnings.push('Total was inferred from transaction values. Please verify.');
    } else {
      warnings.push('Total amount could not be reliably detected. Please enter manually.');
    }
  }

  // 5. Extract Tax Amount
  let taxAmount = 0;
  const taxKeywordsRegex = /(?:cgst|sgst|igst|gst|vat|sales\s*tax|service\s*tax|tax\s*amount|tax)\s*(?:@\s*[\d.]+%|\(\d+%\))?\s*[:=\-]?\s*(?:[^\d\n]*)\s*([\d,]+\.?\d*)/i;

  let cgstVal = 0;
  let sgstVal = 0;
  let singleTaxVal = 0;

  for (const line of lines) {
    if (/cgst/i.test(line)) {
      const m = line.match(/cgst[^\d]*([\d,]+\.?\d*)/i);
      if (m && m[1]) cgstVal = parseFloat(m[1].replace(/,/g, '')) || 0;
    } else if (/sgst/i.test(line)) {
      const m = line.match(/sgst[^\d]*([\d,]+\.?\d*)/i);
      if (m && m[1]) sgstVal = parseFloat(m[1].replace(/,/g, '')) || 0;
    } else {
      const m = line.match(taxKeywordsRegex);
      if (m && m[1]) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0 && val < totalAmount) {
          singleTaxVal = val;
        }
      }
    }
  }

  if (cgstVal > 0 || sgstVal > 0) {
    taxAmount = +(cgstVal + sgstVal).toFixed(2);
  } else if (singleTaxVal > 0) {
    taxAmount = singleTaxVal;
  } else {
    taxAmount = 0; // Never invent fake tax numbers
  }

  // 6. Extract Line Items (Reliable extraction)
  const items: ReceiptItem[] = [];
  const lineItemRegex = /^(.+?)\s+(\d+)?\s*(?:[xX@]\s*)?(?:[₹$€£]|rs\.?)?\s*([\d,]+\.\d{2})$/;

  for (const line of lines) {
    // Skip headers, totals, tax, footer
    if (/(total|subtotal|cgst|sgst|gst|tax|payment|paid|change|balance|gstin|date|time|thank|welcome|items?:|cashier)/i.test(line)) {
      continue;
    }

    const match = line.match(lineItemRegex);
    if (match) {
      const name = match[1].replace(/[^\w\s&',.-]/g, '').trim();
      const qty = match[2] ? parseInt(match[2], 10) : 1;
      const price = parseFloat(match[3].replace(/,/g, ''));

      if (name.length > 2 && price > 0 && price <= (totalAmount || 100000)) {
        items.push({
          name,
          qty: isNaN(qty) ? 1 : qty,
          price,
        });
      }
    }
  }

  // 7. Predict Category using deterministic keyword classification
  const fullTextLower = `${merchant} ${text}`.toLowerCase();
  let category: TransactionCategory = 'Shopping';

  if (
    /(cafe|coffee|restaurant|burger|pizza|dining|bistro|starbucks|mcdonald|kfc|domino|bakery|biryani|kitchen|frappe|tea|swiggy|zomato|dosa|biscotti|food)/i.test(
      fullTextLower
    )
  ) {
    category = 'Food';
  } else if (
    /(supermarket|grocer|reliance\s*fresh|bigbasket|dmart|spencer|vegetable|fruit|atta|oil|butter|milk|provisions|bazaar|market)/i.test(
      fullTextLower
    )
  ) {
    category = 'Groceries';
  } else if (
    /(uber|ola|taxi|cab|fuel|petrol|diesel|shell|hp|indianoil|metro|parking|train|flight|irctc|toll|auto|ride)/i.test(
      fullTextLower
    )
  ) {
    category = 'Transport';
  } else if (
    /(pharmacy|chemist|apollo|medplus|hospital|clinic|doctor|medicine|lab|diagnostics|healthcare)/i.test(
      fullTextLower
    )
  ) {
    category = 'Healthcare';
  } else if (
    /(pvr|inox|cinepolis|cinema|movie|theatre|netflix|spotify|event|show|entertainment|game)/i.test(
      fullTextLower
    )
  ) {
    category = 'Entertainment';
  } else if (
    /(electricity|water|gas|bescom|tata\s*power|broadband|wifi|airtel|jio|bill\s*desk|utility)/i.test(
      fullTextLower
    )
  ) {
    category = 'Utilities';
  } else if (
    /(hotel|airbnb|resort|booking\.com|makemytrip|stay|flight|travel|tourism)/i.test(
      fullTextLower
    )
  ) {
    category = 'Travel';
  } else if (
    /(school|college|tuition|course|coursera|udemy|books|stationary|education)/i.test(
      fullTextLower
    )
  ) {
    category = 'Education';
  } else if (
    /(zara|h&m|uniqlo|myntra|amazon|flipkart|lifestyle|shoppers|clothing|apparel|footwear|mall)/i.test(
      fullTextLower
    )
  ) {
    category = 'Shopping';
  }

  // 8. Predict Payment Method
  let paymentMethod: PaymentMethod = 'Credit Card';
  if (/(upi|qr\s*scan|gpay|phonepe|paytm|bhim|vpa|instant\s*transfer)/i.test(fullTextLower)) {
    paymentMethod = 'UPI / Instant Transfer';
  } else if (/(debit\s*card|atm|maestro)/i.test(fullTextLower)) {
    paymentMethod = 'Debit Card';
  } else if (/(cash|tendered|change\s*due)/i.test(fullTextLower)) {
    paymentMethod = 'Cash';
  } else if (/(net\s*banking|imps|neft|rtgs)/i.test(fullTextLower)) {
    paymentMethod = 'Net Banking';
  } else if (/(visa|mastercard|amex|credit\s*card|pos\s*auth)/i.test(fullTextLower)) {
    paymentMethod = 'Credit Card';
  }

  // 9. Calculate OCR Confidence Score (0-100)
  let score = 20; // base for having text
  if (merchant && merchant !== 'Store / Merchant') score += 20;
  if (totalAmount > 0) score += 35;
  if (date) score += 10;
  if (taxAmount > 0 || /cgst|sgst|gst|tax/i.test(text)) score += 5;
  if (items.length > 0) score += 10;

  const confidence = Math.min(98, Math.max(20, score));
  const isLowConfidence = totalAmount <= 0 || confidence < 65;

  if (isLowConfidence) {
    warnings.push('Some information could not be reliably extracted. Please review or enter it manually.');
  }

  const notes = `Local Open-Source OCR: Extracted via on-device Tesseract engine (${confidence}% confidence).`;

  return {
    merchant: merchant || 'Store / Merchant',
    date,
    totalAmount,
    taxAmount,
    currency: detectedCurrency,
    currencySymbol,
    category,
    paymentMethod,
    items,
    confidence,
    isLowConfidence,
    notes,
    rawText: text,
    warnings,
  };
}
