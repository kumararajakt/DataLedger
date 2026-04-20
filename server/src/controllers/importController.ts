import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { parseCsvBuffer } from '../services/parser/csvParser';
import { parseExcelBuffer } from '../services/parser/excelParser';
import { parsePdfBuffer } from '../services/parser/pdfParser';
import type { ParsedRow } from '../services/parser/bankFormats';
import { normalizeRows, type NormalizedTransaction } from '../services/normalizer';
import { filterDuplicates, generateHash } from '../services/dedup';
import { categorizeTransactions } from '../services/categorizer';
import { rebuildMonth } from '../services/snapshotBuilder';
import { getAiSettings } from '../services/ai/client';
import { enrichImport } from '../services/ai/enrichImport';

// ── Job store ──────────────────────────────────────────────────────────────

interface ImportJob {
  transactions: NormalizedTransaction[];
  source: 'csv' | 'pdf';
}

export const importJobs = new Map<string, ImportJob>();
const jobTimestamps = new Map<string, number>();
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanupExpiredJobs(): void {
  const now = Date.now();
  for (const [jobId, timestamp] of jobTimestamps.entries()) {
    if (now - timestamp > JOB_TTL_MS) {
      importJobs.delete(jobId);
      jobTimestamps.delete(jobId);
    }
  }
}

function storeJob(
  transactions: NormalizedTransaction[],
  source: 'csv' | 'pdf'
): string {
  const jobId = crypto.randomUUID();
  importJobs.set(jobId, { transactions, source });
  jobTimestamps.set(jobId, Date.now());
  return jobId;
}

// ── Multer ─────────────────────────────────────────────────────────────────

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isCSV =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (isCSV) cb(null, true);
    else cb(new Error('Only CSV files are allowed'));
  },
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPDF =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (isPDF) cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const isExcel =
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls');
    if (isExcel) cb(null, true);
    else cb(new Error('Only Excel files are allowed'));
  },
});

// ── Shared parse → preview helper ─────────────────────────────────────────

function buildPreviewRows(transactions: NormalizedTransaction[]) {
  return transactions.map((tx) => ({
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    categoryId: tx.categoryId ?? null,
    hash: tx.hash,
    notes: tx.notes ?? null,
    aiEnriched: !!(tx.notes || tx.aiCategoryName),
  }));
}

async function buildPreview(
  userId: string,
  parsedRows: ParsedRow[],
  source: 'csv' | 'pdf',
  catByName?: Map<string, string>
) {
  const normalized = normalizeRows(parsedRows);
  const { unique, duplicates } = await filterDuplicates(pool, userId, normalized);
  const categorized = await categorizeTransactions(pool, userId, unique);

  // Resolve Python-suggested categories for any still-uncategorized transactions
  if (catByName) {
    for (const tx of categorized) {
      if (!tx.categoryId && tx.aiCategoryName) {
        tx.categoryId = catByName.get(tx.aiCategoryName.toLowerCase()) ?? null;
      }
    }
  }

  const jobId = storeJob(categorized, source);

  return {
    jobId,
    transactions: buildPreviewRows(categorized),
    duplicates,
    toImport: categorized.length,
  };
}

// ── Shared confirm helper ──────────────────────────────────────────────────

interface EditedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId?: string | null;
  notes?: string | null;
}

async function confirmJob(
  jobId: string,
  userId: string,
  edited?: EditedTransaction[]
): Promise<{ imported: number; skipped: number; failed: number }> {
  const job = importJobs.get(jobId);
  if (!job)
    return Promise.reject({
      status: 404,
      message: 'Import job not found or expired. Please re-upload the file.',
    });

  // Single-use: remove immediately
  importJobs.delete(jobId);
  jobTimestamps.delete(jobId);

  const { source } = job;

  // Use client-provided edits if supplied, otherwise fall back to job store
  const transactions: NormalizedTransaction[] =
    edited && edited.length > 0
      ? edited.map((tx) => ({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          categoryId: tx.categoryId ?? null,
          notes: tx.notes ?? undefined,
          hash: generateHash(userId, tx.date, tx.amount, tx.description),
          rawRow: {},
        }))
      : job.transactions;
  if (transactions.length === 0) return { imported: 0, skipped: 0, failed: 0 };

  let imported = 0,
    skipped = 0,
    failed = 0;
  const affectedMonths = new Set<string>();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_user_id',
      userId,
    ]);

    for (const tx of transactions) {
      try {
        const hash =
          tx.hash ?? generateHash(userId, tx.date, tx.amount, tx.description);

        const existing = await client.query(
          `SELECT id FROM transactions WHERE user_id = $1 AND hash = $2`,
          [userId, hash]
        );
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO transactions
             (user_id, category_id, date, description, amount, type, source, hash, raw_data, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            userId,
            tx.categoryId ?? null,
            tx.date,
            tx.description,
            tx.amount,
            tx.type,
            source,
            hash,
            JSON.stringify(tx.rawRow),
            tx.notes ?? null,
          ]
        );

        affectedMonths.add(tx.date.substring(0, 7) + '-01');
        imported++;
      } catch {
        failed++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await Promise.all(
    Array.from(affectedMonths).map((month) =>
      rebuildMonth(pool, userId, month).catch((err) =>
        console.error(`Snapshot rebuild failed for ${month}:`, err)
      )
    )
  );

  return { imported, skipped, failed };
}

export class ImportController {
  // Multer middleware instances
  static csvUpload = csvUpload;
  static excelUpload = excelUpload;
  static pdfUpload = pdfUpload;

  // POST /api/import/csv
  static async uploadCsv(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      cleanupExpiredJobs();
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const userId = req.user!.userId;
      let parsedRows;
      try {
        parsedRows = parseCsvBuffer(req.file.buffer);
      } catch (err) {
        res.status(400).json({
          error: 'Failed to parse CSV',
          details: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      const preview = await buildPreview(userId, parsedRows, 'csv');
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/import/csv/confirm/:jobId
  static async confirmCsvImport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await confirmJob(
        req.params.jobId,
        req.user!.userId,
        req.body?.transactions
      );
      res.json(result);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err) {
        const e = err as { status: number; message: string };
        res.status(e.status).json({ error: e.message });
      } else {
        next(err);
      }
    }
  }

  // POST /api/import/excel
  static async uploadExcel(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      cleanupExpiredJobs();
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const userId = req.user!.userId;
      let parsedRows;
      try {
        parsedRows = parseExcelBuffer(req.file.buffer);
      } catch (err) {
        res.status(400).json({
          error: 'Failed to parse Excel file',
          details: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      const preview = await buildPreview(userId, parsedRows, 'csv');
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/import/excel/confirm/:jobId
  static async confirmExcelImport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await confirmJob(
        req.params.jobId,
        req.user!.userId,
        req.body?.transactions
      );
      res.json(result);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err) {
        const e = err as { status: number; message: string };
        res.status(e.status).json({ error: e.message });
      } else {
        next(err);
      }
    }
  }

  // POST /api/import/pdf
  static async uploadPdf(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      cleanupExpiredJobs();
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const userId = req.user!.userId;

      // Fetch categorization rules to send to Python classifier
      const rulesResult = await pool.query<{ keyword: string; category_name: string; category_id: string }>(
        `SELECT cr.keyword, c.name AS category_name, c.id AS category_id
         FROM categorization_rules cr
         JOIN categories c ON cr.category_id = c.id
         WHERE cr.user_id = $1 OR cr.user_id IS NULL
         ORDER BY cr.priority DESC`,
        [userId]
      );
      const classifierRules = rulesResult.rows.map((r) => ({
        keyword: r.keyword,
        category_name: r.category_name,
      }));
      const catByName = new Map(
        rulesResult.rows.map((r) => [r.category_name.toLowerCase(), r.category_id])
      );

      let parsedRows;
      try {
        parsedRows = await parsePdfBuffer(req.file.buffer, classifierRules);
      } catch (err) {
        res.status(400).json({
          error: 'Failed to parse PDF',
          details: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      const preview = await buildPreview(userId, parsedRows, 'pdf', catByName);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/import/pdf/confirm/:jobId
  static async confirmPdfImport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await confirmJob(
        req.params.jobId,
        req.user!.userId,
        req.body?.transactions
      );
      res.json(result);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err) {
        const e = err as { status: number; message: string };
        res.status(e.status).json({ error: e.message });
      } else {
        next(err);
      }
    }
  }

  // POST /api/import/enrich/:jobId
  static async enrichImport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user!.userId;

      const job = importJobs.get(jobId);
      if (!job) {
        res
          .status(404)
          .json({
            error:
              'Import job not found or expired. Please re-upload the file.',
          });
        return;
      }

      const aiSettings = await getAiSettings(userId);
      if (!aiSettings) {
        res.status(400).json({ error: 'AI is not configured or is disabled.' });
        return;
      }

      // Load categories for name → ID resolution
      const catResult = await pool.query(
        `SELECT id, name FROM categories
         WHERE user_id = $1 OR (is_system = true AND user_id IS NULL)`,
        [userId]
      );
      const categories: { id: string; name: string }[] = catResult.rows;
      const categoryNames = categories.map((c) => c.name);
      const catByName = new Map(
        categories.map((c) => [c.name.toLowerCase(), c.id])
      );

      // Enrich — always fall back to originals on any failure; never return 500 for AI errors
      let enriched: NormalizedTransaction[];
      let aiError: string | undefined;
      try {
        enriched = await enrichImport(job.transactions, aiSettings, categoryNames);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[AI enrich] enrichImport threw, returning original data:', msg);
        enriched = job.transactions;
        aiError = msg;
      }

      // Resolve AI category names → IDs for previously-uncategorized transactions
      const resolved = enriched.map((tx) => ({
        ...tx,
        categoryId:
          tx.categoryId ??
          (tx.aiCategoryName
            ? catByName.get(tx.aiCategoryName.toLowerCase()) ?? null
            : null),
      }));

      // Update job in memory with enriched data
      importJobs.set(jobId, { ...job, transactions: resolved });

      res.json({
        transactions: buildPreviewRows(resolved),
        toImport: resolved.length,
        ...(aiError ? { warning: `AI enrichment failed: ${aiError}` } : {}),
      });
    } catch (err) {
      next(err);
    }
  }
}
