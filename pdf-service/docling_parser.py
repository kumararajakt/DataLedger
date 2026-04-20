"""
Docling-based PDF table parser.

Uses IBM's Docling library which combines:
- PDF text layer extraction (for digital PDFs — no OCR needed)
- Vision-based layout analysis (DocLayNet model)
- Table structure recognition (TableFormer model)

This correctly handles:
- Multi-line description cells (grouped into a single cell)
- S.No. / serial number columns (ignored via header mapping)
- Right-aligned numeric columns
- Bordered tables in ICICI, HDFC, SBI, Axis bank statements
"""

import io
import logging
import tempfile
import os
from typing import Optional

from banks.utils import parse_date, parse_amount, clean_description

logger = logging.getLogger(__name__)

# Column keyword map — same as table_parser.py
COLUMN_KEYWORDS = {
    "date": [
        "transaction date", "txn date", "tran date", "value date", "date"
    ],
    "description": [
        "transaction remarks", "remarks", "narration", "particulars",
        "description", "details", "narrative",
    ],
    "debit": [
        "withdrawal amount", "withdrawal (inr)", "withdrawal amt", "withdrawals",
        "debit amount", "debit", "dr",
    ],
    "credit": [
        "deposit amount", "deposit (inr)", "deposit amt", "deposits",
        "credit amount", "credit", "cr",
    ],
    "balance": [
        "closing balance", "available balance", "balance"
    ],
}


def _normalise(text: str) -> str:
    import re
    return re.sub(r"\s+", " ", str(text).lower()).strip()


def _map_header(cells: list[str]) -> dict[int, str]:
    """Map header cell indices to semantic column types."""
    mapping: dict[int, str] = {}
    assigned: set[str] = set()

    for idx, cell in enumerate(cells):
        norm = _normalise(cell)
        if len(norm) < 2:
            continue
        for col_type, keywords in COLUMN_KEYWORDS.items():
            if col_type in assigned:
                continue
            for kw in keywords:
                if kw in norm or (len(norm) >= 3 and norm in kw):
                    mapping[idx] = col_type
                    assigned.add(col_type)
                    logger.debug(f"Docling column {idx} '{norm}' → {col_type}")
                    break
            if idx in mapping:
                break

    return mapping


def _parse_table_rows(
    rows: list[list[str]],
    col_map: dict[int, str],
) -> list[dict]:
    """Convert raw table rows into transaction dicts using the column mapping.

    Handles the case where Docling splits a single PDF table row across two
    consecutive data rows because of long multi-line description cells:
      - Forward stitch:  NO_AMT row  → ORPHAN row  (date+desc / amounts split)
      - Reverse stitch:  ORPHAN row  → NO_AMT row  (amounts before date in stream)
      - Two-amount orphan: one orphan carries debit+credit for two adjacent rows;
        assigns debit to the first pending row and saves credit as a leftover for
        the next pending row.
    """
    # ── Phase 1: extract raw fields from every row ────────────────────────────
    raw: list[tuple] = []
    for row in rows:
        date_val = description = debit = credit = balance = None
        for col_idx, col_type in col_map.items():
            if col_idx >= len(row):
                continue
            cell = str(row[col_idx]).strip() if row[col_idx] is not None else ""
            if not cell or cell.lower() in ("none", "-", ""):
                continue
            if col_type == "date":
                date_val = parse_date(cell) or date_val
            elif col_type == "description":
                description = clean_description(cell)
            elif col_type == "debit":
                debit = parse_amount(cell)
            elif col_type == "credit":
                credit = parse_amount(cell)
            elif col_type == "balance":
                balance = parse_amount(cell)
        raw.append((date_val, description, debit, credit, balance))

    # ── Phase 2: stitch orphan rows ───────────────────────────────────────────
    transactions: list[dict] = []
    # leftover credit from a two-amount orphan (debit assigned to prev row,
    # credit held for the next NO_AMT row that has no orphan of its own)
    pending_credit: float | None = None
    i = 0
    while i < len(raw):
        date_val, description, debit, credit, balance = raw[i]
        has_date = bool(date_val)
        has_amount = bool(debit or credit)

        if has_date and has_amount:
            # ── Complete row ──────────────────────────────────────────────────
            _emit(transactions, date_val, description, debit, credit, balance)
            i += 1

        elif has_date and not has_amount:
            # ── Partial row (NO_AMT): look ahead for an orphan ────────────────
            stitched = False
            if i + 1 < len(raw):
                n_date, n_desc, n_debit, n_credit, n_balance = raw[i + 1]
                if not n_date and (n_debit or n_credit):
                    # Forward stitch: borrow amounts from the next orphan row
                    bal = n_balance or balance
                    if n_debit and n_credit:
                        # Two amounts in one orphan — debit → this row, credit → leftover
                        _emit(transactions, date_val, description, n_debit, pending_credit, bal)
                        pending_credit = float(n_credit)
                    else:
                        _emit(transactions, date_val, description, n_debit,
                              n_credit or pending_credit, bal)
                        pending_credit = None
                    i += 2
                    stitched = True

            if not stitched:
                # No orphan next — apply any leftover credit saved from a
                # previous two-amount split
                if pending_credit is not None:
                    _emit(transactions, date_val, description, None, pending_credit, balance)
                    pending_credit = None
                # else: genuinely no amount → discard row
                i += 1

        elif not has_date and has_amount:
            # ── Orphan row (no date): reverse stitch into next NO_AMT row ─────
            stitched = False
            if i + 1 < len(raw):
                n_date, n_desc, n_debit, n_credit, n_balance = raw[i + 1]
                if n_date and not n_debit and not n_credit:
                    # Reverse stitch: orphan provides amounts, next row provides date
                    desc = _pick_desc(description, n_desc)
                    bal = balance or n_balance
                    _emit(transactions, n_date, desc, debit, credit, bal)
                    i += 2
                    stitched = True

            if not stitched:
                i += 1  # no partner — discard

        else:
            # ── Blank row (no date, no amount) ────────────────────────────────
            i += 1

    return transactions


def _emit(
    transactions: list[dict],
    date_val: str,
    description: str | None,
    debit,
    credit,
    balance,
) -> None:
    """Validate and append a transaction dict, applying the header-row guard."""
    if not date_val:
        return
    if not debit and not credit:
        return
    desc_lower = (description or "").lower()
    if any(kw in desc_lower for kw in ("date", "txn", "narration", "particulars")):
        return
    transactions.append({
        "date": date_val,
        "description": description or "",
        "debit": float(debit) if debit else 0.0,
        "credit": float(credit) if credit else 0.0,
        "balance": float(balance) if balance else None,
    })


def _pick_desc(desc1: str | None, desc2: str | None) -> str | None:
    """Return the more meaningful of two descriptions.

    A description that is purely numeric (e.g. a cheque number that leaked
    into the remarks column) is considered less meaningful than a text one.
    When both are equally valid, the longer one is preferred.
    """
    import re as _re
    if not desc1:
        return desc2
    if not desc2:
        return desc1
    if _re.match(r"^\d+$", desc1.strip()):
        return desc2
    if _re.match(r"^\d+$", desc2.strip()):
        return desc1
    return desc1 if len(desc1) >= len(desc2) else desc2


def parse_with_docling(pdf_bytes: bytes) -> list[dict]:
    """
    Parse a bank statement PDF using Docling's table extraction pipeline.

    Docling converts the PDF to a structured document model:
    - For digital PDFs it uses the embedded text layer (fast, no OCR)
    - The TableFormer model identifies table regions and cell structure
    - Each table is exported as a pandas DataFrame

    Returns list of transaction dicts.
    """
    try:
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
    except ImportError:
        logger.error("Docling not installed. Run: pip install docling")
        return []

    # Write bytes to a temp file — Docling requires a file path
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    all_transactions: list[dict] = []

    try:
        # Configure pipeline: use embedded text layer, enable table structure model
        pipeline_opts = PdfPipelineOptions()
        pipeline_opts.do_ocr = False          # digital PDF — use text layer
        pipeline_opts.do_table_structure = True   # run TableFormer
        pipeline_opts.table_structure_options.do_cell_matching = True

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_opts)
            }
        )

        result = converter.convert(tmp_path)
        doc = result.document

        logger.info(f"Docling: found {len(doc.tables)} table(s) in document")

        for table_idx, table in enumerate(doc.tables):
            # Export to pandas DataFrame — Docling merges multi-line cells for us
            df = table.export_to_dataframe()
            if df is None or df.empty:
                continue

            # The first row is the header
            header_cells = [str(c) for c in df.columns.tolist()]
            # Sometimes Docling puts header in row 0 instead of column names
            # Try both
            col_map = _map_header(header_cells)

            if len(col_map) < 2:
                # Try treating row 0 as header
                if len(df) > 0:
                    header_cells = [str(c) for c in df.iloc[0].tolist()]
                    col_map = _map_header(header_cells)
                    data_rows = df.iloc[1:].values.tolist()
                else:
                    continue
            else:
                data_rows = df.values.tolist()

            if len(col_map) < 2:
                logger.debug(f"Docling table {table_idx}: could not map columns, skipping")
                continue

            logger.info(f"Docling table {table_idx}: col_map={col_map}, {len(data_rows)} data rows")

            txns = _parse_table_rows(data_rows, col_map)
            if txns:
                logger.info(f"Docling table {table_idx}: extracted {len(txns)} transactions")
                all_transactions.extend(txns)

    except Exception as e:
        logger.error(f"Docling parsing failed: {e}", exc_info=True)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    logger.info(f"Docling: {len(all_transactions)} total transactions")
    return all_transactions
