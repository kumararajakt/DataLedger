"""
PDF Parser Orchestration Module

Parsing pipeline (in order):
1. ML parser   — KMeans clustering on word x-coordinates to find column positions
2. Table parser — pdfplumber header-mapped structured table extraction
3. Camelot     — fallback for PDFs that pdfplumber can't table-extract
"""

import logging
import io
import os
import tempfile
from typing import Optional, Tuple
import fitz  # pymupdf
import pdfplumber

from banks.utils import parse_date, parse_amount, clean_description, validate_balance_continuity
from banks.table_parser import parse_table
from ml_parser import parse_with_ml

logger = logging.getLogger(__name__)

MAX_PDF_SIZE = 20 * 1024 * 1024  # 20 MB


# ── PDF type / scanned detection ──────────────────────────────────────────────

def _is_scanned(pdf_bytes: bytes) -> Tuple[bool, int]:
    """Return (is_scanned, page_count). Scanned = avg chars/page < 50."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)
        total_chars = sum(len(page.get_text()) for page in doc)
        doc.close()
        return total_chars < 50 * page_count, page_count
    except Exception as e:
        logger.error(f"Error checking PDF: {e}")
        return False, 0


# ── Main entry point ──────────────────────────────────────────────────────────

def parse_pdf(
    pdf_bytes: bytes,
    bank_hint: Optional[str] = None,
    enable_ocr: bool = False,
) -> dict:
    """
    Parse a bank statement PDF.

    Tries three strategies in order:
      1. ML parser (KMeans column detection) — works for any layout
      2. Table parser (pdfplumber header-mapping) — works for bordered tables
      3. Camelot — last resort for complex PDFs

    Args:
        pdf_bytes: Raw PDF bytes.
        bank_hint: Ignored (kept for API compatibility).
        enable_ocr: Run OCR when a scanned PDF is detected.
    """
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return _error("PDF exceeds size limit")

    scanned, page_count = _is_scanned(pdf_bytes)

    if scanned:
        if enable_ocr:
            try:
                from ocr import parse_with_ocr
                txns = parse_with_ocr(pdf_bytes)
                return _result(txns or [], "ocr", page_count,
                               error=None if txns else "OCR found no transactions")
            except Exception as e:
                logger.error(f"OCR failed: {e}")
                return _error("OCR parsing failed", page_count)
        return _error("Scanned PDF detected. Enable OCR to process.", page_count)

    # ── Strategy 1: ML parser ─────────────────────────────────────────────
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            transactions = parse_with_ml(pdf)

        if transactions:
            logger.info(f"ML parser extracted {len(transactions)} transactions")
            return _result(transactions, "ml", page_count)

    except Exception as e:
        logger.error(f"ML parser failed: {e}")

    # ── Strategy 2: Table parser (header-mapped pdfplumber) ───────────────
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            transactions = parse_table(pdf)

        if transactions:
            logger.info(f"Table parser extracted {len(transactions)} transactions")
            return _result(transactions, "pdfplumber", page_count)

    except Exception as e:
        logger.error(f"Table parser failed: {e}")

    # ── Strategy 3: Camelot ───────────────────────────────────────────────
    logger.info("Attempting camelot fallback")
    try:
        import camelot
        from banks.table_parser import _map_header_columns, _normalise_cell, _parse_data_row

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        try:
            tables = camelot.read_pdf(tmp_path, pages="all", flavor="stream")
            if not tables or len(tables) == 0:
                tables = camelot.read_pdf(tmp_path, pages="all", flavor="lattice")

            if tables and len(tables) > 0:
                all_rows: list = []
                for table in tables:
                    all_rows.extend(table.df.values.tolist())

                transactions = _parse_camelot_rows(all_rows)
                if transactions:
                    logger.info(f"Camelot extracted {len(transactions)} transactions")
                    return _result(transactions, "camelot", page_count)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Camelot failed: {e}")

    logger.warning("No transactions found in PDF")
    return _result([], "none", page_count, error="No transaction table found in PDF")


# ── Camelot row parser (uses same header-mapping logic as table_parser) ───────

_COL_KEYWORDS = {
    "date":        ["transaction date", "txn date", "tran date", "value date", "date"],
    "description": ["transaction remarks", "remarks", "narration", "particulars", "description"],
    "debit":       ["withdrawal amount", "withdrawal (inr)", "withdrawal amt", "debit amount", "debit", "dr"],
    "credit":      ["deposit amount", "deposit (inr)", "deposit amt", "credit amount", "credit", "cr"],
    "balance":     ["closing balance", "available balance", "balance"],
}


def _parse_camelot_rows(rows: list) -> list[dict]:
    import re

    def norm(v) -> str:
        return re.sub(r"\s+", " ", str(v).lower()).strip()

    # Find header row
    header_idx = header_row = None
    for idx, row in enumerate(rows[:5]):
        if not row:
            continue
        row_text = " ".join(norm(c) for c in row if c)
        matches = sum(1 for kws in _COL_KEYWORDS.values() for kw in kws if kw in row_text)
        if matches >= 2:
            header_idx, header_row = idx, row
            break

    if header_row is None:
        return []

    # Map columns
    col_map: dict[int, str] = {}
    assigned: set[str] = set()
    for idx, cell in enumerate(header_row):
        if cell is None:
            continue
        cell_lower = norm(cell)
        for col_type, kws in _COL_KEYWORDS.items():
            if col_type in assigned:
                continue
            if any(kw in cell_lower or (len(cell_lower) >= 3 and cell_lower in kw) for kw in kws):
                col_map[idx] = col_type
                assigned.add(col_type)
                break

    transactions = []
    for row in rows[header_idx + 1:]:
        if not row:
            continue
        date_val = description = debit = credit = balance = None
        for col_idx, col_type in col_map.items():
            if col_idx >= len(row) or row[col_idx] is None:
                continue
            cell_str = str(row[col_idx]).strip()
            if col_type == "date":
                date_val = parse_date(cell_str)
            elif col_type == "description":
                description = clean_description(cell_str)
            elif col_type == "debit":
                debit = parse_amount(cell_str)
            elif col_type == "credit":
                credit = parse_amount(cell_str)
            elif col_type == "balance":
                balance = parse_amount(cell_str)

        if not date_val or (not debit and not credit):
            continue
        transactions.append({
            "date": date_val,
            "description": description or "",
            "debit": float(debit) if debit else 0.0,
            "credit": float(credit) if credit else 0.0,
            "balance": float(balance) if balance else None,
        })

    return transactions


# ── Result helpers ────────────────────────────────────────────────────────────

def _result(
    transactions: list[dict],
    method: str,
    page_count: int,
    pages_with_transactions: int = 0,
    error: Optional[str] = None,
) -> dict:
    warnings = validate_balance_continuity(transactions) if transactions else []
    date_range = None
    if transactions:
        dates = [t["date"] for t in transactions if t.get("date")]
        if dates:
            date_range = {"from": min(dates), "to": max(dates)}

    return {
        "transactions": transactions,
        "bank": None,
        "method": method,
        "page_count": page_count,
        "pages_with_transactions": pages_with_transactions,
        "rows_skipped": 0,
        "date_range": date_range,
        "warnings": warnings,
        "error": error,
    }


def _error(msg: str, page_count: int = 0) -> dict:
    return _result([], "none", page_count, error=msg)
