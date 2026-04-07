import type { NormalizedTransaction } from '../normalizer';
import { callAi, type AiSettings } from './client';

interface AiRow {
  note: string;
  category: string;
}

/**
 * Enriches a batch of normalized transactions with AI-generated notes and
 * category suggestions. Sends all transactions in a single prompt to keep
 * API cost low. Falls back to the original transactions on any error.
 */
export async function enrichImport(
  transactions: NormalizedTransaction[],
  settings: AiSettings,
  categoryNames: string[]
): Promise<NormalizedTransaction[]> {
  if (transactions.length === 0) return transactions;

  const catList = categoryNames.join(', ');

  // Build a compact numbered list — cap description at 120 chars to stay within token budgets
  const txList = transactions
    .map((tx, i) => {
      const sign   = tx.amount > 0 ? '+' : '';
      const desc   = tx.description.substring(0, 120).replace(/"/g, "'");
      return `${i + 1}. [${tx.date}] "${desc}" ${sign}${tx.amount.toFixed(2)}`;
    })
    .join('\n');

  const prompt = `You are a financial assistant specialising in Indian bank transactions.

For each transaction below provide:
1. A short human-readable note (≤60 chars) describing what it likely is.
   - For UPI refs like "UPI/CREDPAYSWI/credpay.swiggy/..." → "Swiggy food delivery"
   - For EBA/EQ Trade → "ICICI direct mutual fund trade"
   - For INF/INFT/Salary → "Salary credit"
   - For ATM → "ATM cash withdrawal"
2. The single best-fit category from: ${catList}. Use "Other" if none fit.

Return ONLY a JSON array with exactly ${transactions.length} objects in the same order:
[{"note":"...","category":"..."}, ...]

Transactions:
${txList}`;

  const raw = await callAi(settings, [{ role: 'user', content: prompt }], 2048).catch((err: unknown) => {
    console.warn('[AI enrichImport] API call failed, skipping enrichment:', err instanceof Error ? err.message : err);
    return null;
  });

  if (raw === null) return transactions;

  let rows: AiRow[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) rows = JSON.parse(match[0]) as AiRow[];
  } catch {
    console.warn('[AI enrichImport] Failed to parse AI response JSON, skipping enrichment.');
    return transactions;
  }

  return transactions.map((tx, i) => {
    const ai = rows[i];
    if (!ai) return tx;
    return {
      ...tx,
      notes:           typeof ai.note === 'string' && ai.note.trim() ? ai.note.trim() : tx.notes,
      aiCategoryName:  typeof ai.category === 'string' && ai.category.trim() ? ai.category.trim() : undefined,
    };
  });
}
