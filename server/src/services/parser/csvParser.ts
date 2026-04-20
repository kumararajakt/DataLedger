import { parse } from 'csv-parse/sync';
import { detectBankFormat, ParsedRow, BankFormat } from './bankFormats';

interface ParseOptions {
  skipEmptyLines?: boolean;
}

/**
 * Attempts to parse a CSV buffer into raw string records.
 * Returns an array of arrays (rows of string values).
 */
function parseRawCsv(buffer: Buffer): string[][] {
  const content = buffer.toString('utf-8');

  // Try comma first, then semicolon, then tab
  for (const delimiter of [',', ';', '\t']) {
    try {
      const records = parse(content, {
        delimiter,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
      }) as string[][];

      // Must have at least 2 rows and 2 columns to be valid
      if (records.length >= 2 && records[0].length >= 2) {
        return records;
      }
    } catch {
      // Try next delimiter
    }
  }

  throw new Error('Unable to parse CSV: unrecognized format or delimiter');
}

/**
 * Finds the header row index by looking for rows that match known bank format columns.
 * Returns the index of the header row.
 */
export function findHeaderRow(rows: string[][]): {
  headerIndex: number;
  format: BankFormat;
} {
  // Try each row as a potential header (check first 30 rows max)
  const maxCheck = Math.min(rows.length, 30);

  for (let i = 0; i < maxCheck; i++) {
    const potentialHeaders = rows[i].map((h) => h.trim());
    const format = detectBankFormat(potentialHeaders);

    if (format.name !== 'Generic') {
      return { headerIndex: i, format };
    }
  }

  // Fall back to first row as header with generic format
  const headers = rows[0].map((h) => h.trim());
  const format = detectBankFormat(headers);
  return { headerIndex: 0, format };
}

/**
 * Converts rows after the header row into Record<string, string> objects
 * using the header row as keys.
 */
export function rowsToRecords(
  rows: string[][],
  headerIndex: number,
  headers: string[]
): Record<string, string>[] {
  const records: Record<string, string>[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip rows that are obviously not data (all empty, or too short)
    if (row.every((cell) => !cell.trim())) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (row[idx] ?? '').trim();
    });

    records.push(record);
  }

  return records;
}

/**
 * Validates that a parsed row has meaningful data.
 */
export function isValidRow(row: ParsedRow): boolean {
  if (!row.date || row.date.trim() === '') return false;
  if (!row.description || row.description.trim() === '') return false;

  // Check if the date looks like a valid date (basic check)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false;

  const dateObj = new Date(row.date);
  if (isNaN(dateObj.getTime())) return false;

  // At least one of debit or credit should be non-zero (or description is meaningful)
  // Allow zero-amount rows if they have a good description
  return true;
}

/**
 * Parse a CSV buffer and return an array of ParsedRows.
 * Auto-detects bank format.
 */
export function parseCsvBuffer(
  buffer: Buffer,
  _options: ParseOptions = {}
): ParsedRow[] {
  const rawRows = parseRawCsv(buffer);
  return parseDelimitedRows(rawRows);
}

export function parseDelimitedRows(rawRows: string[][]): ParsedRow[] {
  if (rawRows.length === 0) {
    throw new Error('Spreadsheet is empty');
  }

  const { headerIndex, format } = findHeaderRow(rawRows);
  const headerRow = rawRows[headerIndex].map((h) => h.trim());

  // Convert rows to records
  const records = rowsToRecords(rawRows, headerIndex, headerRow);

  if (records.length === 0) {
    throw new Error('No data rows found in CSV after header');
  }

  // Parse each record using the detected format
  const parsedRows: ParsedRow[] = [];

  for (const record of records) {
    try {
      const parsed = format.parseRow(record);

      // Skip rows with no meaningful date (e.g., summary/footer rows)
      if (parsed.date && isValidRow(parsed)) {
        parsedRows.push(parsed);
      }
    } catch {
      // Skip rows that fail to parse
    }
  }

  if (parsedRows.length === 0) {
    throw new Error('No valid transaction rows found');
  }

  return parsedRows;
}
