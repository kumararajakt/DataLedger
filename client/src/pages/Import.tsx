import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAiSettings } from '../hooks/useAiSettings';
import type { Transaction } from '../types';

type Step     = 'upload' | 'preview' | 'result';
type FileType = 'csv' | 'pdf';

interface PreviewTransaction extends Partial<Transaction> {
  notes?: string | null;
  aiEnriched?: boolean;
}

interface PreviewData {
  jobId: string;
  transactions: PreviewTransaction[];
  duplicates: number;
  toImport: number;
}

interface ResultData {
  imported: number;
  skipped:  number;
  failed:   number;
}

const CSV_BANK_FORMATS = [
  { bank: 'SBI',   format: 'Txn Date · Description · Debit · Credit · Balance' },
  { bank: 'HDFC',  format: 'Date · Narration · Withdrawal Amt. · Deposit Amt. · Closing Balance (header row 22)' },
  { bank: 'ICICI', format: 'Transaction Date · Details · Amount (INR) · CR/DR' },
  { bank: 'Axis',  format: 'Tran Date · Particulars · Credit · Debit · Balance' },
];

const PDF_BANK_FORMATS = [
  { bank: 'SBI',   note: 'Digital e-statements from SBI netbanking / YONO' },
  { bank: 'HDFC',  note: 'Digital PDF statements from HDFC netbanking' },
  { bank: 'ICICI', note: 'Digital PDF statements from iMobile / netbanking' },
  { bank: 'Axis',  note: 'Digital PDF statements from Axis mobile / netbanking' },
];

const MAX_CSV_SIZE = 10 * 1024 * 1024;
const MAX_PDF_SIZE = 20 * 1024 * 1024;

const Import: React.FC = () => {
  const navigate             = useNavigate();
  const { showError, showSuccess } = useToast();
  const { data: aiSettings } = useAiSettings();

  const [fileType, setFileType]     = useState<FileType>('csv');
  const [step, setStep]             = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [enriching, setEnriching]   = useState(false);
  const [useAiParsing, setUseAiParsing] = useState(false);
  const [preview, setPreview]       = useState<PreviewData | null>(null);
  const [result, setResult]         = useState<ResultData | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow]       = useState<{ date: string; description: string; amount: string; type: 'income' | 'expense' } | null>(null);

  const aiEnabled = aiSettings?.enabled && aiSettings?.hasApiKey;

  const validateFile = (file: File): string | null => {
    if (fileType === 'csv') {
      if (!file.name.toLowerCase().endsWith('.csv')) return 'Please select a CSV file.';
      if (file.size > MAX_CSV_SIZE) return 'CSV file must be under 10 MB.';
    } else {
      if (!file.name.toLowerCase().endsWith('.pdf')) return 'Please select a PDF file.';
      if (file.size > MAX_PDF_SIZE) return 'PDF file must be under 20 MB.';
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const err = validateFile(file);
    if (err) { showError(err); return; }
    setSelectedFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileType]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const endpoint = fileType === 'csv' ? '/api/import/csv' : '/api/import/pdf';
      const response = await apiClient.post<PreviewData>(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: fileType === 'pdf' && useAiParsing ? { useAi: 'true' } : undefined,
      });
      setPreview(response.data);
      setStep('preview');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { details?: string; error?: string } } })?.response?.data;
      showError(detail?.details ?? detail?.error ?? 'Failed to parse file. Please check the format.');
    } finally {
      setUploading(false);
    }
  };

  const handleEnhanceWithAi = async () => {
    if (!preview) return;
    setEnriching(true);
    try {
      const response = await apiClient.post<{ transactions: PreviewTransaction[]; toImport: number; warning?: string }>(
        `/api/import/enrich/${preview.jobId}`
      );
      setPreview((p) =>
        p ? { ...p, transactions: response.data.transactions, toImport: response.data.toImport } : p
      );
      if (response.data.warning) {
        showError(`AI enrichment failed: ${response.data.warning}`);
      } else {
        showSuccess('Transactions enriched with AI. Review notes and categories before confirming.');
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { error?: string } } })?.response?.data;
      showError(detail?.error ?? 'AI enrichment failed. You can still import without it.');
    } finally {
      setEnriching(false);
    }
  };

  const handleEditStart = (idx: number) => {
    if (!preview) return;
    const t = preview.transactions[idx];
    setEditingIdx(idx);
    setEditRow({
      date:        t.date ? t.date.substring(0, 10) : '',
      description: t.description ?? '',
      amount:      String(Math.abs(t.amount ?? 0)),
      type:        t.type as 'income' | 'expense' ?? 'expense',
    });
  };

  const handleEditSave = (idx: number) => {
    if (!preview || !editRow) return;
    const absAmount = parseFloat(editRow.amount) || 0;
    const signedAmount = editRow.type === 'expense' ? -Math.abs(absAmount) : Math.abs(absAmount);
    const updated = preview.transactions.map((t, i) =>
      i === idx
        ? { ...t, date: editRow.date, description: editRow.description, amount: signedAmount, type: editRow.type }
        : t
    );
    setPreview({ ...preview, transactions: updated });
    setEditingIdx(null);
    setEditRow(null);
  };

  const handleEditCancel = () => {
    setEditingIdx(null);
    setEditRow(null);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const endpoint = fileType === 'csv'
        ? `/api/import/csv/confirm/${preview.jobId}`
        : `/api/import/pdf/confirm/${preview.jobId}`;
      const response = await apiClient.post<ResultData>(endpoint, {
        transactions: preview.transactions.map((t) => ({
          date:        t.date,
          description: t.description,
          amount:      t.amount,
          type:        t.type,
          categoryId:  t.categoryId ?? null,
          notes:       t.notes ?? null,
        })),
      });
      setResult(response.data);
      setStep('result');
      showSuccess('Import completed!');
    } catch {
      showError('Import confirmation failed. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    setEditingIdx(null);
    setEditRow(null);
    setStep('upload');
  };

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
  };

  const handleFileTypeChange = (type: FileType) => {
    setFileType(type);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatAmount = (amount: number) =>
    `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const accept  = fileType === 'csv' ? '.csv' : '.pdf';
  const fileIcon = fileType === 'csv' ? '📊' : '📄';
  const hasAiNotes = preview?.transactions.some((t) => t.notes);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Import Transactions</h1>
      </div>

      {/* Step indicator */}
      <div className="import-steps">
        {(['upload', 'preview', 'result'] as Step[]).map((s, idx) => (
          <div
            key={s}
            className={`import-step ${step === s ? 'import-step-active' : ''} ${
              (['upload', 'preview', 'result'] as Step[]).indexOf(step) > idx ? 'import-step-done' : ''
            }`}
          >
            <span className="import-step-num">{idx + 1}</span>
            <span className="import-step-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          </div>
        ))}
      </div>

      {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="card import-card">

          {/* File type toggle */}
          <div className="file-type-tabs">
            <button
              className={`file-type-tab ${fileType === 'csv' ? 'file-type-tab-active' : ''}`}
              onClick={() => handleFileTypeChange('csv')}
            >
              📊 CSV Statement
            </button>
            <button
              className={`file-type-tab ${fileType === 'pdf' ? 'file-type-tab-active' : ''}`}
              onClick={() => handleFileTypeChange('pdf')}
            >
              📄 PDF Statement
            </button>
          </div>

          {fileType === 'pdf' && (
            <div className="pdf-notice">
              <span className="pdf-notice-icon">ℹ️</span>
              <p>
                PDF parsing works with <strong>digital</strong> bank statements (downloaded from
                netbanking). Scanned or photographed statements cannot be parsed.
              </p>
            </div>
          )}

          {fileType === 'pdf' && aiEnabled && (
            <label className="ai-parse-option" style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem',
              background: '#eff6ff',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={useAiParsing}
                onChange={(e) => setUseAiParsing(e.target.checked)}
                style={{
                  marginTop: '0.2rem',
                  width: '1.1rem',
                  height: '1.1rem',
                  cursor: 'pointer',
                }}
              />
              <div>
                <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.25rem' }}>
                  ✦ Analyze with AI
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#3b82f6' }}>
                  Use AI to parse the PDF directly. Better for complex or non-standard formats, but uses more API tokens.
                </p>
              </div>
            </label>
          )}

          {/* Dropzone */}
          <div
            className={`dropzone ${isDragging ? 'dropzone-active' : ''} ${selectedFile ? 'dropzone-selected' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
            {selectedFile ? (
              <>
                <span className="dropzone-icon">{fileIcon}</span>
                <p className="dropzone-filename">{selectedFile.name}</p>
                <p className="dropzone-filesize">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                <p className="dropzone-change">Click to change file</p>
              </>
            ) : (
              <>
                <span className="dropzone-icon">{fileIcon}</span>
                <p className="dropzone-text">
                  Drag &amp; drop your {fileType.toUpperCase()} file here, or{' '}
                  <span className="dropzone-link">click to browse</span>
                </p>
                <p className="dropzone-hint">
                  {fileType === 'csv' ? 'CSV only, max 10 MB' : 'PDF only, max 20 MB'}
                </p>
              </>
            )}
          </div>

          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={!selectedFile}
            loading={uploading}
            className="btn-full"
          >
            Upload &amp; Preview
          </Button>

          {/* Format reference table */}
          <div className="bank-formats">
            <h3 className="bank-formats-title">
              {fileType === 'csv' ? 'Supported CSV Column Formats' : 'Supported PDF Statement Sources'}
            </h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bank</th>
                    <th>{fileType === 'csv' ? 'CSV Columns' : 'Source'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(fileType === 'csv' ? CSV_BANK_FORMATS : PDF_BANK_FORMATS).map((b) => (
                    <tr key={b.bank}>
                      <td><strong>{b.bank}</strong></td>
                      <td><code className="code-text">{'format' in b ? b.format : b.note}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview ────────────────────────────────────────────── */}
      {step === 'preview' && preview && (
        <div className="card import-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Preview Import</h2>

            {/* AI enhance button */}
            {aiEnabled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEnhanceWithAi}
                loading={enriching}
                disabled={preview.toImport === 0}
                title="Use AI to add notes and improve categorization"
              >
                ✨ Enhance with AI
              </Button>
            )}
          </div>

          {/* AI disclaimer */}
          {hasAiNotes && (
            <div style={{
              margin: '0.75rem 0',
              padding: '0.6rem 1rem',
              borderRadius: '0.4rem',
              background: '#eff6ff',
              color: '#1e40af',
              fontSize: '0.82rem',
            }}>
              ✦ AI-generated notes shown below. Review before confirming — AI can make mistakes.
            </div>
          )}

          <div className="import-summary-pills">
            <span className="pill pill-info">{preview.toImport} to import</span>
            <span className="pill pill-warning">{preview.duplicates} duplicates skipped</span>
            <span className="pill pill-neutral">{preview.transactions.length} total parsed</span>
            <span className="pill pill-source">{fileType.toUpperCase()}</span>
            {hasAiNotes && <span className="pill" style={{ background: '#dbeafe', color: '#1d4ed8' }}>✦ AI enhanced</span>}
          </div>

          {preview.transactions.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description {hasAiNotes && <span style={{ color: '#6366f1', fontSize: '0.75rem' }}>/ AI Note</span>}</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th style={{ width: '6rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions.map((t, idx) => (
                    editingIdx === idx && editRow ? (
                      <tr key={idx} style={{ background: '#f8fafc' }}>
                        <td>
                          <input
                            type="date"
                            value={editRow.date}
                            onChange={(e) => setEditRow({ ...editRow, date: e.target.value })}
                            style={{ width: '100%', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.2rem 0.4rem' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editRow.description}
                            onChange={(e) => setEditRow({ ...editRow, description: e.target.value })}
                            style={{ width: '100%', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.2rem 0.4rem' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editRow.amount}
                            onChange={(e) => setEditRow({ ...editRow, amount: e.target.value })}
                            style={{ width: '7rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.2rem 0.4rem' }}
                          />
                        </td>
                        <td>
                          <select
                            value={editRow.type}
                            onChange={(e) => setEditRow({ ...editRow, type: e.target.value as 'income' | 'expense' })}
                            style={{ fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.2rem 0.4rem' }}
                          >
                            <option value="expense">expense</option>
                            <option value="income">income</option>
                          </select>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleEditSave(idx)}
                            style={{ fontSize: '0.78rem', marginRight: '0.4rem', padding: '0.15rem 0.5rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                          >Save</button>
                          <button
                            onClick={handleEditCancel}
                            style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                          >Cancel</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx}>
                        <td>{t.date ? formatDate(t.date) : '—'}</td>
                        <td>
                          <div>{t.description}</div>
                          {t.notes && (
                            <div style={{ fontSize: '0.78rem', color: '#6366f1', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              ✦ {t.notes}
                            </div>
                          )}
                        </td>
                        <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                          {t.type === 'expense' ? '-' : '+'}{formatAmount(t.amount ?? 0)}
                        </td>
                        <td>
                          <span className={`badge badge-type-${t.type}`}>{t.type}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleEditStart(idx)}
                            title="Edit transaction"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem', padding: '0.15rem 0.4rem' }}
                          >✏️</button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-center" style={{ padding: '2rem 0' }}>
              All transactions in this file are duplicates — nothing new to import.
            </p>
          )}

          <div className="form-actions">
            <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={confirming}
              disabled={preview.toImport === 0}
            >
              Confirm Import ({preview.toImport} transactions)
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Result ─────────────────────────────────────────────── */}
      {step === 'result' && result && (
        <div className="card import-card import-result">
          <div className="import-result-icon">✅</div>
          <h2 className="import-result-title">Import Complete!</h2>
          <div className="import-result-grid">
            <div className="import-result-item result-success">
              <span className="result-count">{result.imported}</span>
              <span className="result-label">Imported</span>
            </div>
            <div className="import-result-item result-warning">
              <span className="result-count">{result.skipped}</span>
              <span className="result-label">Skipped (duplicates)</span>
            </div>
            <div className="import-result-item result-danger">
              <span className="result-count">{result.failed}</span>
              <span className="result-label">Failed</span>
            </div>
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={handleReset}>Import Another File</Button>
            <Button variant="primary" onClick={() => navigate('/transactions')}>Go to Transactions</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Import;
