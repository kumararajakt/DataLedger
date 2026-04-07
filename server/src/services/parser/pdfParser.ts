import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { normalizeDate, parseAmount, type ParsedRow } from "./bankFormats";
import { getAiSettings } from "../ai/client";
import { parsePdfWithAi } from "../ai/parsePdfWithAi";
import FormData from "form-data";
import axios from "axios";

// Polyfill DOMMatrix for Node.js environment (required by pdfjs-dist)
if (!(globalThis as any).DOMMatrix) {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor(_init?: string | number[]) {
      return this;
    }
    multiply() { return this; }
    invert() { return this; }
    transformPoint(point: { x: number; y: number }) { return { x: point.x, y: point.y }; }
  };
}

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";

// Python PDF Service URL (from environment)
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || "http://localhost:5001";

/**
 * Call Python PDF parsing service.
 * Forwards the user's AI settings so the Python service can use AI as a fallback
 * when structured parsing (pdfplumber/camelot) finds nothing.
 * Returns null if service is unavailable (will fall through to Node.js parser).
 */
async function parseWithPythonService(
  buffer: Buffer,
  userId?: string,
): Promise<ParsedRow[] | null> {
  try {
    const formData = new FormData();
    formData.append("file", buffer, {
      filename: "statement.pdf",
      contentType: "application/pdf",
    });

    // Forward AI settings if the user has them configured
    if (userId) {
      try {
        const aiSettings = await getAiSettings(userId);
        if (aiSettings) {
          formData.append("ai_provider", aiSettings.provider);
          formData.append("ai_api_key", aiSettings.apiKey);
          formData.append("ai_base_url", aiSettings.baseUrl);
          formData.append("ai_model", aiSettings.model);
        }
      } catch {
        // AI settings unavailable — proceed without them
      }
    }

    const response = await axios.post(`${PDF_SERVICE_URL}/parse`, formData, {
      headers: formData.getHeaders(),
      timeout: 90000, // 90s to allow time for AI fallback
      validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data.transactions?.length) {
      console.log("[PDF parser] Python service returned no transactions, falling back to Node.js");
      return null;
    }

    const transactions: ParsedRow[] = response.data.transactions.map((t: any) => ({
      date: t.date,
      description: t.description || "",
      debit: t.debit || 0,
      credit: t.credit || 0,
      rawRow: { raw: t.description || "", method: response.data.method, bank: response.data.bank },
    }));

    console.log(`[PDF parser] Python service (${response.data.method}) extracted ${transactions.length} transactions`);
    return transactions;
  } catch (error) {
    console.log(
      "[PDF parser] Python service unavailable, falling back to Node.js:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// ── Bank detection ─────────────────────────────────────────────────────────

type BankName = "SBI" | "HDFC" | "ICICI" | "Axis" | "Generic";

const BANK_SIGNATURES: Array<{ name: BankName; pattern: RegExp }> = [
  { name: "SBI", pattern: /State Bank of India|SBI\s+Statement|SBIINB|YONO SBI/i },
  { name: "HDFC", pattern: /HDFC Bank|HDFC BANK|HDFCBANK/i },
  { name: "ICICI", pattern: /ICICI Bank|ICICI BANK/i },
  { name: "Axis", pattern: /Axis Bank|AXIS BANK|UTIB\b/i },
];

function detectBank(text: string): BankName {
  for (const { name, pattern } of BANK_SIGNATURES) {
    if (pattern.test(text)) return name;
  }
  return "Generic";
}

// ── Structured cell extraction (X/Y positions preserved) ──────────────────

interface TextCell {
  text: string;
  x: number;
  y: number;
}

async function extractCells(buffer: Uint8Array): Promise<TextCell[][]> {
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const allRows: TextCell[][] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const items = content.items
      .filter((item): item is TextItem => "str" in item && item.str.trim() !== "")
      .map((item) => ({
        text: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }));

    // Group by Y coordinate (rows), then sort left → right within each row
    const byY: Record<number, TextCell[]> = {};
    items.forEach((cell) => {
      if (!byY[cell.y]) byY[cell.y] = [];
      byY[cell.y].push(cell);
    });

    const rows = Object.keys(byY)
      .sort((a, b) => Number(b) - Number(a)) // PDF origin is bottom-left, so descending = top-to-bottom
      .map((y) => byY[Number(y)].sort((a, b) => a.x - b.x));

    allRows.push(...rows);
  }

  return allRows;
}

// ── ICICI structured table parser ─────────────────────────────────────────
//
// ICICI PDF statements have these columns (left → right):
//   S No. | Transaction Date | Cheque Number | Transaction Remarks | Withdrawal Amount (INR) | Deposit Amount (INR) | Balance (INR)
//
// Transaction Remarks often wrap across multiple Y-coordinate rows.
// We identify new transactions by finding rows where the "date" column contains
// a DD.MM.YYYY value, then append continuation rows to that transaction's remarks.

const ICICI_DATE_RE = /^\d{1,2}\.\d{1,2}\.\d{4}$/;

function parseIciciTable(rows: TextCell[][]): ParsedRow[] {
  // Find the header row: must contain "Transaction Date" AND "Withdrawal"
  const headerRowIdx = rows.findIndex(
    (row) =>
      row.some((c) => /Transaction\s*Date/i.test(c.text)) &&
      row.some((c) => /Withdrawal/i.test(c.text))
  );
  if (headerRowIdx === -1) return [];

  const headerRow = rows[headerRowIdx];

  // Locate each column's X anchor from the header cells
  const find = (re: RegExp) => headerRow.find((c) => re.test(c.text));
  const dateHeader       = find(/Transaction\s*Date/i);
  const withdrawalHeader = find(/Withdrawal/i);
  const depositHeader    = find(/Deposit/i);
  const balanceHeader    = find(/Balance/i);

  if (!dateHeader || !withdrawalHeader || !depositHeader) return [];

  const dateX       = dateHeader.x;
  const withdrawalX = withdrawalHeader.x;
  const depositX    = depositHeader.x;
  const balanceX    = balanceHeader?.x ?? depositX + 80;

  // Assign each cell to a logical column based on proximity to header X positions
  type ColName = "sno" | "date" | "remarks" | "withdrawal" | "deposit" | "balance";
  const COL_TOL = 40;

  function getCol(cell: TextCell): ColName {
    const x = cell.x;
    if (Math.abs(x - balanceX) <= COL_TOL) return "balance";
    if (Math.abs(x - depositX) <= COL_TOL) return "deposit";
    if (Math.abs(x - withdrawalX) <= COL_TOL) return "withdrawal";
    if (Math.abs(x - dateX) <= COL_TOL) return "date";
    if (x < dateX - COL_TOL) return "sno";
    // Everything between date and withdrawal columns is remarks
    return "remarks";
  }

  const results: ParsedRow[] = [];
  let cur: { date: string; desc: string; withdrawal: number; deposit: number } | null = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];

    const dateCells = row.filter((c) => getCol(c) === "date");
    const isNewTx   = dateCells.some((c) => ICICI_DATE_RE.test(c.text));

    if (isNewTx) {
      // Flush previous transaction
      if (cur) {
        results.push({
          date: cur.date,
          description: cur.desc.replace(/\s+/g, " ").trim(),
          debit: cur.withdrawal,
          credit: cur.deposit,
          rawRow: { raw: cur.desc },
        });
      }

      const rawDate    = dateCells.find((c) => ICICI_DATE_RE.test(c.text))!.text;
      const remarkCells    = row.filter((c) => getCol(c) === "remarks");
      const withdrawalCell = row.find((c) => getCol(c) === "withdrawal");
      const depositCell    = row.find((c) => getCol(c) === "deposit");

      cur = {
        date:       normalizeDate(rawDate),
        desc:       remarkCells.map((c) => c.text).join(" "),
        withdrawal: parseAmount(withdrawalCell?.text),
        deposit:    parseAmount(depositCell?.text),
      };
    } else if (cur) {
      // Continuation row: append any text that falls in the remarks column area
      const contCells = row.filter((c) => getCol(c) === "remarks");
      if (contCells.length > 0) {
        cur.desc += " " + contCells.map((c) => c.text).join(" ");
      }
    }
  }

  // Flush final transaction
  if (cur) {
    results.push({
      date: cur.date,
      description: cur.desc.replace(/\s+/g, " ").trim(),
      debit: cur.withdrawal,
      credit: cur.deposit,
      rawRow: { raw: cur.desc },
    });
  }

  return results;
}

// ── Patterns for generic flat-text parsing ─────────────────────────────────

// Matches a date at the start of a (possibly S.No.-stripped) line.
// Handles: DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY  DD Mon YYYY  YYYY-MM-DD
const LINE_DATE_RE =
  /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4}-\d{2}-\d{2})/i;

const AMOUNT_RE = /([\d,]+\.\d{2})/g;

const CREDIT_KEYWORDS =
  /\b(credit|credited|salary|received|refund|reversal|dividend|interest earned|neft cr|imps cr|upi cr|deposit)\b/i;

const DEBIT_KEYWORDS =
  /\b(debit|debited|payment|purchase|withdrawal|transfer|neft dr|imps dr|upi dr|emi|atm)\b/i;

function parseLine(line: string, bank: BankName): ParsedRow | null {
  // Strip optional leading S.No. (one or more digits followed by whitespace)
  const stripped = line.replace(/^\d+\s+/, "");

  const dateMatch = stripped.match(LINE_DATE_RE);
  if (!dateMatch) return null;

  const date = normalizeDate(dateMatch[1]);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const dateObj = new Date(date);
  if (
    isNaN(dateObj.getTime()) ||
    dateObj.getFullYear() < 2000 ||
    dateObj.getFullYear() > 2050
  ) {
    return null;
  }

  const rest = stripped.slice(dateMatch[0].length).trim();
  const amountMatches = [...rest.matchAll(AMOUNT_RE)];
  if (amountMatches.length === 0) return null;

  const amounts = amountMatches.map((m) => parseAmount(m[1]));

  const firstAmountPos = rest.search(AMOUNT_RE);
  let description =
    firstAmountPos > 0
      ? rest.slice(0, firstAmountPos).trim()
      : rest.replace(new RegExp(AMOUNT_RE.source, "g"), "").trim();

  description = description.replace(/\s+/g, " ").trim();
  description = description.replace(/[\/\-|]+$/, "").trim();

  if (!description || description.length < 2) return null;

  let debit = 0;
  let credit = 0;

  const hasCr = /\bCR\b/i.test(rest) || CREDIT_KEYWORDS.test(description);
  const hasDr = /\bDR\b/i.test(rest) || DEBIT_KEYWORDS.test(description);

  if (amounts.length >= 3) {
    const a = amounts[amounts.length - 3];
    const b = amounts[amounts.length - 2];

    if (a > 0 && b === 0) {
      debit = a;
    } else if (b > 0 && a === 0) {
      credit = b;
    } else if (a > 0 && b > 0) {
      if (bank === "Axis") {
        if (hasCr) credit = a;
        else debit = b;
      } else {
        if (hasCr) credit = b;
        else debit = a;
      }
    }
  } else if (amounts.length === 2) {
    const txnAmount = amounts[0];
    if (hasCr && !hasDr) credit = txnAmount;
    else if (hasDr && !hasCr) debit = txnAmount;
    else if (CREDIT_KEYWORDS.test(description)) credit = txnAmount;
    else debit = txnAmount;
  } else {
    const txnAmount = amounts[0];
    if (hasCr && !hasDr) credit = txnAmount;
    else debit = txnAmount;
  }

  if (debit === 0 && credit === 0) return null;

  return {
    date,
    description,
    debit,
    credit,
    rawRow: { raw: line, bank },
  };
}

function mergeMultiLineTransactions(lines: string[]): string[] {
  const merged: string[] = [];
  let current = "";

  for (const line of lines) {
    const stripped = line.replace(/^\d+\s+/, "");
    if (LINE_DATE_RE.test(stripped)) {
      if (current) merged.push(current);
      current = line;
    } else if (
      current &&
      line.length > 0 &&
      line.length <= 80 &&
      !/^\d/.test(line)
    ) {
      current = `${current} ${line}`;
    } else {
      if (current) merged.push(current);
      current = "";
    }
  }

  if (current) merged.push(current);
  return merged;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface PdfParseOptions {
  /** If true, use AI only as fallback when structured parsing fails (default: true).
      If false, use AI parsing directly without attempting structured parsing first. */
  useAiFallback?: boolean;
}

export async function parsePdfBuffer(
  buffer: Buffer,
  userId?: string,
  options: PdfParseOptions = {}
): Promise<ParsedRow[]> {
  const { useAiFallback = true } = options;

  // ── Step 1: Try Python PDF Service (pdfplumber + AI fallback) ──────────────
  const pythonResult = await parseWithPythonService(buffer, userId);
  if (pythonResult && pythonResult.length > 0) {
    return pythonResult;
  }

  // ── Step 2: Fall back to Node.js structured parsing ─────────────────────

  const typedArray = new Uint8Array(buffer);

  let cells: TextCell[][];
  try {
    cells = await extractCells(typedArray);
  } catch (err) {
    throw new Error(
      `Failed to read PDF: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Build flat text (for bank detection and generic fallback)
  const flatText = cells.map((row) => row.map((c) => c.text).join(" ")).join("\n");

  if (!flatText || flatText.replace(/\s/g, "").length < 50) {
    throw new Error(
      "PDF contains no extractable text. It may be a scanned image — please use a digital bank statement."
    );
  }

  // If user explicitly requested AI parsing, skip structured parsing
  if (!useAiFallback && userId) {
    try {
      const aiSettings = await getAiSettings(userId);
      if (aiSettings) {
        console.log('[PDF parser] Using AI parsing as requested...');
        const aiResults = await parsePdfWithAi(flatText, aiSettings);
        if (aiResults.length > 0) {
          console.log(`[PDF parser] AI extracted ${aiResults.length} transactions`);
          return aiResults;
        }
      }
    } catch (aiErr) {
      console.warn('[PDF parser] AI parsing failed, falling back to structured:', aiErr instanceof Error ? aiErr.message : aiErr);
      // Continue to structured parsing below
    }
  }

  const bank = detectBank(flatText);

  // ── ICICI: use structured column-based parser ──────────────────────────
  if (bank === "ICICI") {
    const results = parseIciciTable(cells);
    if (results.length > 0) return results;
    // Fall through to generic parser if structured parse yields nothing
  }

  // ── Generic flat-text parsing (SBI, HDFC, Axis, unknown) ──────────────
  const rawLines = flatText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lines = mergeMultiLineTransactions(rawLines);
  const results: ParsedRow[] = [];

  for (const line of lines) {
    const stripped = line.replace(/^\d+\s+/, "");
    if (!LINE_DATE_RE.test(stripped)) continue;
    const parsed = parseLine(line, bank);
    if (parsed) results.push(parsed);
  }

  // ── AI Fallback: if structured parsing failed and user has AI enabled ──
  if (results.length === 0 && userId) {
    try {
      const aiSettings = await getAiSettings(userId);
      if (aiSettings) {
        console.log('[PDF parser] Structured parsing failed, trying AI fallback...');
        const aiResults = await parsePdfWithAi(flatText, aiSettings);
        if (aiResults.length > 0) {
          console.log(`[PDF parser] AI fallback extracted ${aiResults.length} transactions`);
          return aiResults;
        }
      }
    } catch (aiErr) {
      console.warn('[PDF parser] AI fallback failed:', aiErr instanceof Error ? aiErr.message : aiErr);
      // Continue to throw original error below
    }
  }

  if (results.length === 0) {
    throw new Error(
      `No valid transactions found in the PDF (detected bank: ${bank}). ` +
        "Ensure this is a digital bank statement, not a scanned copy."
    );
  }

  return results;
}
