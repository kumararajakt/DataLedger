import crypto from 'crypto';
import { Pool } from 'pg';
import { NormalizedTransaction } from './normalizer';

/**
 * Generate a SHA256 hash for a transaction to detect duplicates.
 * Hash is based on: userId + date + amount + normalized description
 */
export function generateHash(
  userId: string,
  date: string,
  amount: number,
  description: string
): string {
  const normalizedDescription = description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const input = `${userId}|${date}|${amount}|${normalizedDescription}`;

  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface DedupResult {
  unique: NormalizedTransaction[];
  duplicates: number;
}

/**
 * Filter out transactions that already exist in the database by hash.
 * Returns unique transactions and count of duplicates found.
 */
export async function filterDuplicates(
  pool: Pool,
  userId: string,
  transactions: NormalizedTransaction[]
): Promise<DedupResult> {
  if (transactions.length === 0) {
    return { unique: [], duplicates: 0 };
  }

  // Generate hashes for all incoming transactions
  const withHashes = transactions.map((tx) => ({
    ...tx,
    hash: generateHash(userId, tx.date, tx.amount, tx.description),
  }));

  // Get all hashes that already exist in the DB for this user
  const incomingHashes = withHashes.map((tx) => tx.hash);

  const existingResult = await pool.query<{ hash: string }>(
    `SELECT hash FROM transactions
     WHERE user_id = $1 AND hash = ANY($2::text[])`,
    [userId, incomingHashes]
  );

  const existingHashSet = new Set(
    existingResult.rows.map((r) => r.hash)
  );

  // Also deduplicate within the batch itself (in case CSV has internal duplicates)
  const seenHashes = new Set<string>();
  const unique: NormalizedTransaction[] = [];
  let duplicates = existingHashSet.size;

  for (const tx of withHashes) {
    if (existingHashSet.has(tx.hash)) {
      // Already in DB
      continue;
    }
    if (seenHashes.has(tx.hash)) {
      // Duplicate within batch
      duplicates++;
      continue;
    }
    seenHashes.add(tx.hash);
    unique.push(tx);
  }

  return { unique, duplicates };
}
