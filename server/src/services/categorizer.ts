import { Pool } from 'pg';
import { NormalizedTransaction } from './normalizer';

interface CategorizationRule {
  keyword: string;
  category_id: string;
  priority: number;
}

/**
 * Two-pass categorization:
 * 1. Load user's categorization rules (priority DESC)
 * 2. Load system rules (user_id IS NULL, priority DESC)
 * Match description case-insensitively against keywords.
 */
export async function categorizeTransactions(
  pool: Pool,
  userId: string,
  transactions: NormalizedTransaction[]
): Promise<NormalizedTransaction[]> {
  if (transactions.length === 0) return transactions;

  // Load user rules (priority DESC)
  const userRulesResult = await pool.query<CategorizationRule>(
    `SELECT keyword, category_id, priority
     FROM categorization_rules
     WHERE user_id = $1
     ORDER BY priority DESC, keyword ASC`,
    [userId]
  );

  // Load system rules (user_id IS NULL, priority DESC)
  const systemRulesResult = await pool.query<CategorizationRule>(
    `SELECT keyword, category_id, priority
     FROM categorization_rules
     WHERE user_id IS NULL
     ORDER BY priority DESC, keyword ASC`,
    []
  );

  const userRules = userRulesResult.rows;
  const systemRules = systemRulesResult.rows;

  // All rules: user rules first (higher precedence), then system rules
  const allRules = [...userRules, ...systemRules];

  return transactions.map((tx) => {
    const categoryId = matchCategory(tx.description, allRules);
    return { ...tx, categoryId: categoryId ?? null };
  });
}

/**
 * Match a description against categorization rules.
 * Returns the category_id of the first matching rule, or null.
 */
function matchCategory(
  description: string,
  rules: CategorizationRule[]
): string | null {
  const normalizedDesc = description.toLowerCase();

  for (const rule of rules) {
    const keyword = rule.keyword.toLowerCase();
    if (normalizedDesc.includes(keyword)) {
      return rule.category_id;
    }
  }

  return null;
}

/**
 * Categorize a single transaction description.
 * Useful for one-off categorization.
 */
export async function categorizeDescription(
  pool: Pool,
  userId: string,
  description: string
): Promise<string | null> {
  const userRulesResult = await pool.query<CategorizationRule>(
    `SELECT keyword, category_id, priority
     FROM categorization_rules
     WHERE user_id = $1
     ORDER BY priority DESC`,
    [userId]
  );

  const systemRulesResult = await pool.query<CategorizationRule>(
    `SELECT keyword, category_id, priority
     FROM categorization_rules
     WHERE user_id IS NULL
     ORDER BY priority DESC`,
    []
  );

  const allRules = [...userRulesResult.rows, ...systemRulesResult.rows];
  return matchCategory(description, allRules);
}
