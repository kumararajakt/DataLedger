export type TransactionType = 'income' | 'expense' | 'transfer';

export interface ParsedRow {
  date: string;
  description: string;
  debit: number;
  credit: number;
  rawRow: Record<string, string>;
}

export interface BankFormat {
  name: 'SBI' | 'HDFC' | 'ICICI' | 'Axis' | 'Generic';
  headerRowIndex: number; // 0-based index
  dateColumn: string;
  descriptionColumn: string;
  debitColumn: string | null;
  creditColumn: string | null;
  amountColumn: string | null; // for banks with single amount column + CR/DR flag
  crDrColumn: string | null;   // column indicating credit or debit
  parseRow: (row: Record<string, string>) => ParsedRow;
}

function parseAmount(value: string | undefined): number {
  if (!value || value.trim() === '' || value.trim() === '-') return 0;
  // Remove commas, spaces, currency symbols
  const cleaned = value.replace(/[,\s₹$]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  // Already ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // MM/DD/YYYY
  const mmddyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${fullYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // DD Mon YYYY (e.g., "01 Jan 2024")
  const ddMonyyyy = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (ddMonyyyy) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const [, dd, mon, yyyy] = ddMonyyyy;
    const mm = months[mon.toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }

  // Return as-is if no format matched
  return trimmed;
}

const SBI_FORMAT: BankFormat = {
  name: 'SBI',
  headerRowIndex: 0,
  dateColumn: 'Txn Date',
  descriptionColumn: 'Description',
  debitColumn: 'Debit',
  creditColumn: 'Credit',
  amountColumn: null,
  crDrColumn: null,
  parseRow: (row) => {
    const date = normalizeDate(row['Txn Date'] ?? '');
    const description = (row['Description'] ?? '').trim().replace(/\s+/g, ' ');
    const debit = parseAmount(row['Debit']);
    const credit = parseAmount(row['Credit']);
    return { date, description, debit, credit, rawRow: row };
  },
};

const HDFC_FORMAT: BankFormat = {
  name: 'HDFC',
  headerRowIndex: 21, // header at row 22 (0-indexed: 21)
  dateColumn: 'Date',
  descriptionColumn: 'Narration',
  debitColumn: 'Withdrawal Amt.',
  creditColumn: 'Deposit Amt.',
  amountColumn: null,
  crDrColumn: null,
  parseRow: (row) => {
    const date = normalizeDate(row['Date'] ?? '');
    const description = (row['Narration'] ?? '').trim().replace(/\s+/g, ' ');
    const debit = parseAmount(row['Withdrawal Amt.']);
    const credit = parseAmount(row['Deposit Amt.']);
    return { date, description, debit, credit, rawRow: row };
  },
};

const ICICI_FORMAT: BankFormat = {
  name: 'ICICI',
  headerRowIndex: 0,
  dateColumn: 'Transaction Date',
  descriptionColumn: 'Details',
  debitColumn: null,
  creditColumn: null,
  amountColumn: 'Amount (INR)',
  crDrColumn: 'CR/DR',
  parseRow: (row) => {
    const date = normalizeDate(row['Transaction Date'] ?? '');
    const description = (row['Details'] ?? '').trim().replace(/\s+/g, ' ');
    const amount = parseAmount(row['Amount (INR)']);
    const crDr = (row['CR/DR'] ?? '').trim().toUpperCase();

    let debit = 0;
    let credit = 0;

    if (crDr === 'CR') {
      credit = amount;
    } else if (crDr === 'DR') {
      debit = amount;
    } else {
      // Fallback: positive is credit, negative is debit
      if (amount >= 0) credit = amount;
      else debit = Math.abs(amount);
    }

    return { date, description, debit, credit, rawRow: row };
  },
};

const AXIS_FORMAT: BankFormat = {
  name: 'Axis',
  headerRowIndex: 0,
  dateColumn: 'Tran Date',
  descriptionColumn: 'Particulars',
  // Axis: "Credit" column = money coming in, "Debit" column = money going out
  // But note: the spec says "credit/debit reversed" for Axis
  debitColumn: 'Debit',
  creditColumn: 'Credit',
  amountColumn: null,
  crDrColumn: null,
  parseRow: (row) => {
    const date = normalizeDate(row['Tran Date'] ?? '');
    const description = (row['Particulars'] ?? '').trim().replace(/\s+/g, ' ');
    // Axis has credit/debit reversed in column naming
    const debit = parseAmount(row['Debit']);
    const credit = parseAmount(row['Credit']);
    return { date, description, debit, credit, rawRow: row };
  },
};

const KNOWN_FORMATS: BankFormat[] = [SBI_FORMAT, HDFC_FORMAT, ICICI_FORMAT, AXIS_FORMAT];

export function detectBankFormat(headers: string[]): BankFormat {
  const normalizedHeaders = headers.map((h) => h.trim());

  for (const format of KNOWN_FORMATS) {
    const requiredColumns = [
      format.dateColumn,
      format.descriptionColumn,
    ];

    if (format.debitColumn) requiredColumns.push(format.debitColumn);
    if (format.creditColumn) requiredColumns.push(format.creditColumn);
    if (format.amountColumn) requiredColumns.push(format.amountColumn);

    const allPresent = requiredColumns.every((col) =>
      normalizedHeaders.includes(col)
    );

    if (allPresent) {
      return format;
    }
  }

  // Return a generic format as fallback
  const genericFormat: BankFormat = {
    name: 'Generic',
    headerRowIndex: 0,
    dateColumn: normalizedHeaders[0] ?? 'Date',
    descriptionColumn: normalizedHeaders[1] ?? 'Description',
    debitColumn: normalizedHeaders[2] ?? null,
    creditColumn: normalizedHeaders[3] ?? null,
    amountColumn: null,
    crDrColumn: null,
    parseRow: (row) => {
      const keys = Object.keys(row);
      const date = normalizeDate(row[keys[0]] ?? '');
      const description = (row[keys[1]] ?? '').trim().replace(/\s+/g, ' ');
      const debit = parseAmount(row[keys[2]]);
      const credit = parseAmount(row[keys[3]]);
      return { date, description, debit, credit, rawRow: row };
    },
  };

  return genericFormat;
}

export { normalizeDate, parseAmount };
