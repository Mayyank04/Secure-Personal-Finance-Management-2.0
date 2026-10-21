import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const symbol = symbols[currency] || (currency === 'INR' ? '₹' : '$');
  const formattedNum = Math.abs(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  });

  return `${amount < 0 ? '-' : ''}${symbol}${formattedNum}`;
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function truncateHash(hash: string, front: number = 8, back: number = 6): string {
  if (!hash || hash.length <= front + back) return hash || 'N/A';
  return `${hash.substring(0, front)}...${hash.substring(hash.length - back)}`;
}

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  Food: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: '#d97706' },
  Groceries: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: '#059669' },
  Transport: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: '#2563eb' },
  Shopping: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', bar: '#9333ea' },
  Entertainment: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', bar: '#db2777' },
  Bills: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', bar: '#e11d48' },
  Utilities: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', bar: '#0891b2' },
  Healthcare: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', bar: '#0d9488' },
  Education: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', bar: '#4f46e5' },
  Travel: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', bar: '#ea580c' },
  Subscriptions: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', bar: '#7c3aed' },
  Rent: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', bar: '#dc2626' },
  Insurance: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', bar: '#0284c7' },
  Investment: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', bar: '#16a34a' },
  Salary: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: '#059669' },
  Freelance: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', bar: '#0d9488' },
  Other: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', bar: '#64748b' },
};
