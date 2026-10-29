import { Response } from 'express';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorPayload;
  message: string; // Root-level string for backwards compatibility with existing UI components
}

export function sendSuccess<T extends Record<string, any>>(
  res: Response,
  statusCode: number,
  data: T,
  message?: string,
  meta?: Record<string, any>
): Response {
  return res.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
    data,
    ...data, // Spreads root keys (e.g. transaction, account, etc.) for existing frontend compatibility
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    message, // Backwards-compatible root message
  });
}

// -----------------------------------------------------------------------------
// Validation Utilities
// -----------------------------------------------------------------------------

export const SUPPORTED_CURRENCIES = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'CHF', 'CNY'
]);

export function parsePositiveAmount(val: any, fieldName = 'Amount'): { value: number; error?: string } {
  if (val === undefined || val === null || val === '') {
    return { value: 0, error: `${fieldName} is required.` };
  }
  const num = Number(val);
  if (isNaN(num)) {
    return { value: 0, error: `${fieldName} must be a valid number.` };
  }
  if (num <= 0) {
    return { value: 0, error: `${fieldName} must be a positive number greater than zero.` };
  }
  if (!isFinite(num)) {
    return { value: 0, error: `${fieldName} must be a finite number.` };
  }
  return { value: Math.round(num * 100) / 100 };
}

export function parseNonNegativeAmount(val: any, fieldName = 'Amount'): { value: number; error?: string } {
  if (val === undefined || val === null || val === '') {
    return { value: 0, error: `${fieldName} is required.` };
  }
  const num = Number(val);
  if (isNaN(num)) {
    return { value: 0, error: `${fieldName} must be a valid number.` };
  }
  if (num < 0) {
    return { value: 0, error: `${fieldName} cannot be negative.` };
  }
  if (!isFinite(num)) {
    return { value: 0, error: `${fieldName} must be a finite number.` };
  }
  return { value: Math.round(num * 100) / 100 };
}

export function isValidIsoDate(str: any): boolean {
  if (typeof str !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/;
  if (!regex.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

export function parsePaginationParams(query: Record<string, any>, defaultLimit = 15, maxLimit = 100) {
  let page = parseInt(String(query.page || '1'), 10);
  let limit = parseInt(String(query.limit || defaultLimit), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
