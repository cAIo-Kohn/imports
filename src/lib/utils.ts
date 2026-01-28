import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractContainerInfo(notes: string | null): string {
  if (!notes) return '-';
  const match = notes.match(/Container:\s*([^|]+)/);
  return match ? match[1].trim() : '-';
}

/**
 * Format number with Brazilian locale (1.234,56)
 * @param value - The number or string to format
 * @param decimals - Number of decimal places (0 for integers)
 */
export function formatBrazilianNumber(value: number | string, decimals: number = 0): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

/**
 * Parse Brazilian formatted number back to raw number
 * "90.000" → 90000
 * "9.000,50" → 9000.50
 */
export function parseBrazilianNumber(formatted: string): number {
  if (!formatted) return 0;
  // Remove thousand separators (dots), replace comma with decimal point
  const cleaned = formatted.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
