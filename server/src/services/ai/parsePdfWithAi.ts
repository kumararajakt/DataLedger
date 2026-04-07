import { callAi, type AiSettings } from './client';
import type { ParsedRow } from '../parser/bankFormats';

interface AiTransaction {
  date: string;
  description: string;
  debit: number;
  credit: number;
}

/**
 * Uses AI to parse raw PDF text into structured transactions.
 * This is a fallback when the structured parser fails to extract transactions.
 */
export async function parsePdfWithAi(
  rawText: string,
  settings: AiSettings
): Promise<ParsedRow[]> {
  const prompt = `You are a financial data extraction assistant. Your task is to parse bank transaction data from raw PDF text.

The text below is extracted from an Indian bank statement PDF. Extract all transactions and return them as a JSON array.

For each transaction, provide:
1. date: in YYYY-MM-DD format (convert from any format like DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, etc.)
2. description: the transaction description/narration (trim whitespace, collapse multiple spaces)
3. debit: amount withdrawn/paid (0 if not applicable)
4. credit: amount deposited/received (0 if not applicable)

Rules:
- Dates must be valid (year between 2000-2050)
- Amounts should be numbers (no commas, no currency symbols)
- Debit = money going out (withdrawal, payment, purchase)
- Credit = money coming in (deposit, salary, refund, reversal)
- Skip balance amounts, headers, footers, and non-transaction text
- Return ONLY a valid JSON array, no other text

Example output format:
[
  {"date": "2024-01-15", "description": "UPI payment to Swiggy", "debit": 250.50, "credit": 0},
  {"date": "2024-01-16", "description": "Salary credit", "debit": 0, "credit": 50000}
]

Raw PDF text:
${rawText.substring(0, 15000)}`; // Cap at 15k chars to stay within token limits

  const raw = await callAi(settings, [{ role: 'user', content: prompt }], 4096);

  if (!raw || raw.trim().length === 0) {
    throw new Error('AI returned empty response');
  }

  let transactions: AiTransaction[] = [];
  try {
    // Extract JSON array from response (AI may include markdown code blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      transactions = JSON.parse(jsonMatch[0]) as AiTransaction[];
    } else {
      throw new Error('No JSON array found in AI response');
    }
  } catch (parseErr) {
    console.warn('[AI parsePdfWithAi] Failed to parse AI response as JSON:', parseErr);
    console.warn('[AI parsePdfWithAi] Raw response:', raw.substring(0, 500));
    throw new Error('Failed to parse AI response as valid JSON');
  }

  if (!Array.isArray(transactions)) {
    throw new Error('AI response is not an array');
  }

  // Validate and transform AI transactions into ParsedRow format
  const results: ParsedRow[] = [];
  const validDateRe = /^\d{4}-\d{2}-\d{2}$/;

  for (const tx of transactions) {
    try {
      // Validate required fields
      if (!tx.date || !tx.description) continue;

      // Validate date format
      if (!validDateRe.test(tx.date)) continue;

      // Validate date is reasonable
      const dateObj = new Date(tx.date);
      if (
        isNaN(dateObj.getTime()) ||
        dateObj.getFullYear() < 2000 ||
        dateObj.getFullYear() > 2050
      ) {
        continue;
      }

      // Validate amounts are numbers
      const debit = typeof tx.debit === 'number' ? tx.debit : 0;
      const credit = typeof tx.credit === 'number' ? tx.credit : 0;

      // Skip if both amounts are zero or negative
      if (debit <= 0 && credit <= 0) continue;

      results.push({
        date: tx.date,
        description: String(tx.description).trim().replace(/\s+/g, ' '),
        debit: Math.abs(debit),
        credit: Math.abs(credit),
        rawRow: { raw: tx.description, source: 'ai' },
      });
    } catch (err) {
      console.warn('[AI parsePdfWithAi] Skipping invalid transaction:', tx, err);
      continue;
    }
  }

  return results;
}
