import * as XLSX from 'xlsx';
import { parseDelimitedRows } from './csvParser';
import type { ParsedRow } from './bankFormats';

function normalizeCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString().substring(0, 10);
  return String(value).trim();
}

export function parseExcelBuffer(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel file contains no worksheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: '',
  });

  const normalizedRows = rows
    .map((row: (string | number | boolean | Date | null)[]) => row.map(normalizeCell))
    .filter((row: string[]) => row.some((cell: string) => cell.trim() !== ''));

  if (normalizedRows.length === 0) {
    throw new Error('Excel sheet is empty');
  }

  return parseDelimitedRows(normalizedRows);
}
