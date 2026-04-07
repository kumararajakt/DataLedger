"""
Header-Mapped Table Parser - Universal Bank Statement Parser

Parses any bank statement PDF by:
1. Trying pdfplumber structured table extraction (works for bordered tables)
2. Falling back to word-coordinate grouping (works for whitespace-delimited tables)

No bank detection needed — header keyword mapping handles all formats.

Supported header label variations:
- Date: "Transaction Date", "Txn Date", "Tran Date", "Value Date", "Date"
- Description: "Remarks", "Narration", "Particulars", "Description", "Details"
- Debit: "Withdrawal (INR)", "Withdrawal Amt.", "Debit Amount", "Debit", "Dr"
- Credit: "Deposit (INR)", "Deposit Amt.", "Credit Amount", "Credit", "Cr"
- Balance: "Closing Balance", "Available Balance", "Balance"
"""

import logging
from typing import Optional
import pdfplumber
from .utils import parse_date, parse_amount, clean_description

logger = logging.getLogger(__name__)

# Column keyword map - order matters (more specific matches first)
COLUMN_KEYWORDS = {
    "date": [
        "transaction date", "txn date", "tran date", "value date", "date"
    ],
    "description": [
        "transaction remarks", "remarks", "narration", "particulars", "description", "details", "narrative"
    ],
    "debit": [
        "withdrawal amount", "withdrawal (inr)", "withdrawal amt", "debit amount", "debit", "dr"
    ],
    "credit": [
        "deposit amount", "deposit (inr)", "deposit amt", "credit amount", "credit", "cr"
    ],
    "balance": [
        "closing balance", "available balance", "balance"
    ],
}

# Y-coordinate tolerance for grouping words into the same row (in PDF points)
Y_TOLERANCE = 3


def parse_table(pdf: pdfplumber.PDF) -> list[dict]:
    """
    Universal bank statement parser.

    Tries structured table extraction first (pdfplumber), then falls back to
    word-coordinate grouping for PDFs where table borders aren't detected.

    Args:
        pdf: pdfplumber PDF object

    Returns:
        list[dict]: Extracted transactions
    """
    all_transactions = []

    for page_idx, page in enumerate(pdf.pages):
        # Strategy 1: structured table extraction
        table_settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "text",
            "snap_tolerance": 4,
        }

        table = page.extract_table(table_settings)
        print(table)
        if table and len(table) >= 2:
            transactions, score = _parse_structured_table(table)
            if transactions:
                logger.info(f"Page {page_idx + 1}: {len(transactions)} transactions via extract_table (score {score})")
                all_transactions.extend(transactions)
                continue

        # Strategy 2: word-coordinate grouping
        transactions = _parse_from_words(page)
        
        if transactions:
            logger.debug(f"Page {page_idx + 1}: {len(transactions)} transactions via word-coordinate grouping")
            all_transactions.extend(transactions)

    logger.info(f"Extracted {len(all_transactions)} transactions total")
    return all_transactions


# ── Strategy 1: structured table ─────────────────────────────────────────────

def _parse_structured_table(table: list) -> tuple[list[dict], int]:
    """Parse a pdfplumber-extracted table using header keyword mapping."""
    if not table or len(table) < 2:
        return [], 0

    header_idx, header_row = _find_header_row(table)
    if header_row is None:
        return [], 0

    col_mapping = _map_header_columns(header_row)
    if not col_mapping:
        return [], 0

    score = len(col_mapping)
    transactions = []
    for row in table[header_idx + 1:]:
        if not row:
            continue
        txn = _parse_data_row(row, col_mapping)
        if txn:
            transactions.append(txn)

    return transactions, score


def _normalise_cell(cell) -> str:
    """Lowercase a cell value and collapse all whitespace (including \\n) to single spaces."""
    import re
    return re.sub(r"\s+", " ", str(cell).lower()).strip()


def _find_header_row(table: list) -> tuple[Optional[int], Optional[list]]:
    """Find the first row in the table that contains banking column keywords."""
    for idx, row in enumerate(table[:5]):
        if not row:
            continue
        row_text = " ".join(_normalise_cell(cell) for cell in row if cell)
        matches = sum(
            1 for kw_list in COLUMN_KEYWORDS.values()
            for kw in kw_list if kw in row_text
        )
        if matches >= 2:
            return idx, row

    # No clear header — try first non-empty row
    for idx, row in enumerate(table[:3]):
        if row and any(cell for cell in row):
            return idx, row

    return None, None


def _map_header_columns(header_row: list) -> dict[int, str]:
    """Map header cells to semantic column types {col_index: col_type}."""
    mapping: dict[int, str] = {}
    assigned: set[str] = set()

    logger.info(f"Header cells raw: {header_row}")

    for idx, cell in enumerate(header_row):
        if cell is None:
            continue
        # Normalise: collapse \n and extra spaces so "Deposit\nAmount (INR)" → "deposit amount (inr)"
        cell_lower = _normalise_cell(cell)
        if len(cell_lower) < 2:
            continue

        for col_type, keywords in COLUMN_KEYWORDS.items():
            if col_type in assigned:
                continue
            for kw in keywords:
                # Bidirectional: kw inside cell OR cell inside kw (handles split headers like "Deposit" matching "deposit amount")
                if kw in cell_lower or (len(cell_lower) >= 3 and cell_lower in kw):
                    mapping[idx] = col_type
                    assigned.add(col_type)
                    logger.info(f"Column {idx} '{cell_lower}' → {col_type}")
                    break
            if idx in mapping:
                break

    logger.info(f"Column mapping: {mapping}")
    return mapping


def _parse_data_row(row: list, col_mapping: dict[int, str]) -> Optional[dict]:
    """Extract a transaction dict from a data row using the column mapping."""
    date_val = None
    description = ""
    debit = None
    credit = None
    balance = None

    for col_idx, col_type in col_mapping.items():
        if col_idx >= len(row):
            continue
        cell = row[col_idx]
        if cell is None:
            continue
        cell_str = str(cell).strip()

        if col_type == "date":
            date_val = parse_date(cell_str) or date_val
        elif col_type == "description":
            description = clean_description(cell_str)
        elif col_type == "debit":
            debit = parse_amount(cell_str)
        elif col_type == "credit":
            credit = parse_amount(cell_str)
        elif col_type == "balance":
            balance = parse_amount(cell_str)

    if not date_val:
        logger.info(f"Skipped row (no date): {row}")
        return None
    if not debit and not credit:
        logger.info(f"Skipped row (no amounts) date={date_val} desc={description!r}")
        return None

    # Skip header-like rows that slipped through
    if any(kw in description.lower() for kw in ["date", "txn", "transaction", "narration", "particulars"]):
        logger.info(f"Skipped row (header-like desc): {description!r}")
        return None

    return {
        "date": date_val,
        "description": description,
        "debit": float(debit) if debit else 0.0,
        "credit": float(credit) if credit else 0.0,
        "balance": float(balance) if balance else None,
    }


# ── Strategy 2: word-coordinate grouping ─────────────────────────────────────

def _parse_from_words(page: pdfplumber.page.Page) -> list[dict]:
    """
    Reconstruct a table from raw word coordinates.

    Groups words by their Y position (within Y_TOLERANCE) into rows, then
    sorts each row left-to-right by X position. Identifies the header row
    using keyword matching, then maps columns by X-coordinate ranges derived
    from the header cells.
    """
    words = page.extract_words(x_tolerance=3, y_tolerance=Y_TOLERANCE)
    if not words:
        return []

    # Group words into rows by rounded Y coordinate
    rows_by_y: dict[int, list[dict]] = {}
    for word in words:
        # Round to nearest tolerance bucket so nearby Y values merge
        y_key = round(word["top"] / Y_TOLERANCE) * Y_TOLERANCE
        rows_by_y.setdefault(y_key, []).append(word)

    # Sort rows top-to-bottom, words left-to-right within each row
    sorted_ys = sorted(rows_by_y.keys())
    rows: list[list[dict]] = [
        sorted(rows_by_y[y], key=lambda w: w["x0"])
        for y in sorted_ys
    ]

    # Find header row
    header_idx = None
    for idx, row in enumerate(rows[:20]):
        row_text = " ".join(w["text"].lower() for w in row)
        matches = sum(
            1 for kw_list in COLUMN_KEYWORDS.values()
            for kw in kw_list if kw in row_text
        )
        if matches >= 2:
            header_idx = idx
            break

    if header_idx is None:
        return []

    header_words = rows[header_idx]

    # Build column X-ranges from header words
    # Each header word anchors a column; the column spans from its x0 to the next header's x0
    col_anchors = _build_column_anchors(header_words)
    if not col_anchors:
        return []

    # Parse data rows
    transactions = []
    # Merge continuation rows (no date in first cell) into the previous transaction
    pending: Optional[dict] = None
    no_amount_streak = 0
    MAX_NO_AMOUNT_STREAK = 4

    for row in rows[header_idx + 1:]:
        row_text = " ".join(w["text"] for w in row).strip()
        if not row_text:
            continue

        # Map words to columns by X position
        cell_map = _map_words_to_columns(row, col_anchors)

        date_val = parse_date(cell_map.get("date", "").strip())

        if date_val:
            # Flush previous pending transaction
            if pending:
                txn = _finalise_pending(pending)
                if txn:
                    transactions.append(txn)

            no_amount_streak = 0
            pending = {
                "date": date_val,
                "description": clean_description(cell_map.get("description", "")),
                "debit": parse_amount(cell_map.get("debit", "")),
                "credit": parse_amount(cell_map.get("credit", "")),
                "balance": parse_amount(cell_map.get("balance", "")),
            }
        elif pending:
            has_amount = any(
                parse_amount(cell_map.get(col, "")) is not None
                for col in ("debit", "credit", "balance")
            )
            if has_amount:
                no_amount_streak = 0
                pending["debit"]   = pending["debit"]   or parse_amount(cell_map.get("debit", ""))
                pending["credit"]  = pending["credit"]  or parse_amount(cell_map.get("credit", ""))
                pending["balance"] = pending["balance"] or parse_amount(cell_map.get("balance", ""))
            else:
                no_amount_streak += 1
                if no_amount_streak > MAX_NO_AMOUNT_STREAK:
                    continue

            # Continuation row: append description text
            extra = cell_map.get("description", "").strip()
            if extra:
                pending["description"] = clean_description(pending["description"] + " " + extra)

    # Flush last pending
    if pending:
        txn = _finalise_pending(pending)
        if txn:
            transactions.append(txn)

    return transactions


def _build_column_anchors(header_words: list[dict]) -> list[dict]:
    """
    Build column anchors {col_type, x0, x1, x_end} from header words.

    pdfplumber splits multi-word headers like "Withdrawal Amt" or "Closing Balance"
    into individual word tokens. We match using both directions:
      - kw in word  (e.g. "date" in "date")
      - word in kw  (e.g. "withdrawal" in "withdrawal (inr)")
    A minimum word length of 3 is required for the second direction to avoid
    short fragments matching long keywords spuriously.

    Adjacent words that map to the same column type are merged so the anchor's
    x0 is the leftmost word and x1 is the rightmost.
    """
    assigned: set[str] = set()
    anchors: list[dict] = []

    for word in header_words:
        cell_lower = word["text"].lower().strip()
        if len(cell_lower) < 2:
            continue

        matched_type = None
        for col_type, keywords in COLUMN_KEYWORDS.items():
            if col_type in assigned:
                continue
            for kw in keywords:
                # Bidirectional: keyword inside word OR word inside keyword
                if kw in cell_lower or (len(cell_lower) >= 3 and cell_lower in kw):
                    matched_type = col_type
                    break
            if matched_type:
                break

        if not matched_type:
            continue

        # Merge with the last anchor if it's the same col_type (adjacent words)
        if anchors and anchors[-1]["col_type"] == matched_type:
            anchors[-1]["x1"] = word["x1"]
        else:
            assigned.add(matched_type)
            anchors.append({"col_type": matched_type, "x0": word["x0"], "x1": word["x1"]})
            logger.debug(f"Column anchor: '{cell_lower}' → {matched_type} @ x={word['x0']:.0f}")

    if not anchors:
        return []

    anchors.sort(key=lambda a: a["x0"])

    # x_end = start of the next column (last column stretches to infinity)
    for i, anchor in enumerate(anchors):
        anchor["x_end"] = anchors[i + 1]["x0"] if i + 1 < len(anchors) else float("inf")

    return anchors


def _map_words_to_columns(row: list[dict], col_anchors: list[dict]) -> dict[str, str]:
    """Assign each word in a row to the column whose X range contains it."""
    cells: dict[str, list[str]] = {a["col_type"]: [] for a in col_anchors}

    for word in row:
        word_x = word["x0"]
        for anchor in col_anchors:
            if anchor["x0"] - 5 <= word_x < anchor["x_end"]:
                cells[anchor["col_type"]].append(word["text"])
                break

    return {col: " ".join(words) for col, words in cells.items()}


def _finalise_pending(pending: dict) -> Optional[dict]:
    """Validate and return a completed pending transaction, or None if invalid."""
    if not pending.get("date"):
        return None
    if not pending.get("debit") and not pending.get("credit"):
        return None
    desc = pending.get("description", "")
    if any(kw in desc.lower() for kw in ["date", "txn", "transaction", "narration", "particulars"]):
        return None
    return {
        "date": pending["date"],
        "description": desc,
        "debit": float(pending["debit"]) if pending.get("debit") else 0.0,
        "credit": float(pending["credit"]) if pending.get("credit") else 0.0,
        "balance": float(pending["balance"]) if pending.get("balance") else None,
    }
