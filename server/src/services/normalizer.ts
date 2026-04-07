import { ParsedRow } from './parser/bankFormats';

export interface NormalizedTransaction {
  date: string;          // YYYY-MM-DD
  description: string;   // trimmed, collapsed whitespace
  amount: number;        // positive = income/credit, negative = expense/debit
  type: 'income' | 'expense' | 'transfer';
  rawRow: Record<string, string>;
  categoryId?: string | null;
  hash?: string;
  notes?: string;             // AI-generated or user-written note
  aiCategoryName?: string;    // transient: AI-suggested category name (resolved to ID in import route)
}

/**
 * Normalize a ParsedRow into a standardized transaction format.
 * - date: ISO YYYY-MM-DD
 * - description: trimmed and collapsed whitespace
 * - amount: credit - debit (positive = income, negative = expense)
 * - type: derived from amount sign
 */
export function normalizeRow(row: ParsedRow): NormalizedTransaction {
  // Normalize date (should already be YYYY-MM-DD from parser)
  const date = normalizeDate(row.date);

  // Normalize description
  const description = row.description
    .trim()
    .replace(/\s+/g, ' ');

  // Calculate net amount: credit (incoming) - debit (outgoing)
  const amount = row.credit - row.debit;

  // Derive type from amount
  let type: 'income' | 'expense' | 'transfer';
  if (amount > 0) {
    type = 'income';
  } else if (amount < 0) {
    type = 'expense';
  } else {
    type = 'transfer';
  }

  return {
    date,
    description,
    amount,
    type,
    rawRow: row.rawRow,
  };
}

/**
 * Normalize a date string to YYYY-MM-DD format.
 */
function normalizeDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Try native Date parsing as last resort
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().substring(0, 10);
  }

  return trimmed;
}

/**
 * Normalize an array of ParsedRows.
 */
export function normalizeRows(rows: ParsedRow[]): NormalizedTransaction[] {
  return rows.map(normalizeRow);
}
