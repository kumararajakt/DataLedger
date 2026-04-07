import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ImportController } from '../controllers/importController';

const router: Router = Router();

router.use(authMiddleware);

// ── CSV routes ─────────────────────────────────────────────────────────────

// POST /api/import/csv
router.post(
  '/csv',
  ImportController.csvUpload.single('file'),
  ImportController.uploadCsv
);

// POST /api/import/csv/confirm/:jobId
router.post('/csv/confirm/:jobId', ImportController.confirmCsvImport);

// ── PDF routes ─────────────────────────────────────────────────────────────

// POST /api/import/pdf
router.post(
  '/pdf',
  ImportController.pdfUpload.single('file'),
  ImportController.uploadPdf
);

// POST /api/import/pdf/confirm/:jobId
router.post('/pdf/confirm/:jobId', ImportController.confirmPdfImport);

// ── AI enrichment ──────────────────────────────────────────────────────────

// POST /api/import/enrich/:jobId
router.post('/enrich/:jobId', ImportController.enrichImport);

export default router;
