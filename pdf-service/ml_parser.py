"""
ML-based PDF table parser using KMeans clustering.

Instead of relying on header keyword positions, this parser:
1. Extracts all words with (x, y) coordinates from pdfplumber
2. Uses KMeans to cluster x-positions of amount-like tokens
   → finds actual debit/credit/balance column centers from the DATA rows
3. Identifies date rows using regex
4. Assigns amounts to the nearest cluster (handles right-aligned numbers correctly)
5. Groups multi-line remarks into the transaction above them

This solves the "right-aligned deposit amounts outside anchor range" problem
because column centers are learned from the data, not the header.
"""

import re
import logging
from typing import Optional
import numpy as np
from sklearn.cluster import KMeans
import pdfplumber

from banks.utils import parse_date, parse_amount, clean_description

logger = logging.getLogger(__name__)

# ── Patterns ──────────────────────────────────────────────────────────────────

# Matches amounts like "107.00", "10,393.75", "78,592.00"
AMOUNT_RE = re.compile(r"^\d[\d,]*\.\d{2}$")

# Matches date formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
DATE_RE = re.compile(
    r"^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$"
    r"|^\d{4}-\d{2}-\d{2}$"
    r"|^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$",
    re.IGNORECASE,
)

# Header keywords to skip those rows
HEADER_WORDS = {
    "date", "transaction", "remarks", "narration", "particulars",
    "withdrawal", "deposit", "balance", "amount", "cheque", "reference",
    "credit", "debit", "description", "details", "no", "s.no",
}


def _is_amount(text: str) -> bool:
    return bool(AMOUNT_RE.match(text.replace(",", "").strip()))


def _is_date(text: str) -> bool:
    return bool(DATE_RE.match(text.strip()))


def _is_header_word(text: str) -> bool:
    return text.lower().strip().rstrip(".") in HEADER_WORDS


def parse_with_ml(pdf: pdfplumber.PDF) -> list[dict]:
    """
    Parse all pages of a pdfplumber PDF using KMeans column detection.

    Returns list of transaction dicts: date, description, debit, credit, balance.
    """
    all_transactions = []

    for page_idx, page in enumerate(pdf.pages):
        txns = _parse_page(page)
        if txns:
            logger.info(f"ML parser: page {page_idx + 1} → {len(txns)} transactions")
            all_transactions.extend(txns)

    logger.info(f"ML parser: {len(all_transactions)} total transactions")
    return all_transactions


def _parse_page(page: pdfplumber.page.Page) -> list[dict]:
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    if not words:
        return []

    # ── Step 1: Find amount column centers via KMeans ──────────────────────
    amount_words = [w for w in words if _is_amount(w["text"]) and not _is_header_word(w["text"])]

    if len(amount_words) < 3:
        logger.debug("ML parser: too few amount tokens for clustering")
        return []

    xs = np.array([[float(w["x0"])] for w in amount_words])

    # Try 3 clusters (debit, credit, balance); fall back to 2 if not enough data
    n_clusters = 3 if len(amount_words) >= 6 else 2
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(xs)
    centers = sorted(kmeans.cluster_centers_.flatten())
    logger.debug(f"ML parser: amount column centers = {[f'{c:.0f}' for c in centers]}")

    # Assign semantic roles by position (left=debit, middle=credit, right=balance)
    # For 2 clusters: left=debit/credit (ambiguous), right=balance
    if n_clusters == 3:
        col_centers = {"debit": centers[0], "credit": centers[1], "balance": centers[2]}
    else:
        col_centers = {"debit": centers[0], "balance": centers[1]}

    # ── Step 2: Group words into rows by Y coordinate ─────────────────────
    rows_by_y: dict[int, list[dict]] = {}
    for w in words:
        y_key = round(float(w["top"]) / 3) * 3
        rows_by_y.setdefault(y_key, []).append(w)

    sorted_rows = [
        sorted(rows_by_y[y], key=lambda w: float(w["x0"]))
        for y in sorted(rows_by_y.keys())
    ]

    # ── Step 3: Find the header row to skip it ────────────────────────────
    header_y_idx = None
    for idx, row in enumerate(sorted_rows[:15]):
        row_text = " ".join(w["text"].lower() for w in row)
        if sum(1 for kw in HEADER_WORDS if kw in row_text) >= 3:
            header_y_idx = idx
            logger.debug(f"ML parser: header row at index {idx}")
            break

    # ── Step 4: Build transactions ────────────────────────────────────────
    transactions = []
    pending: Optional[dict] = None
    # Tracks consecutive continuation rows with no amounts — used to detect
    # footer/legend sections that appear after the last transaction row.
    no_amount_streak = 0
    MAX_NO_AMOUNT_STREAK = 4

    data_rows = sorted_rows[header_y_idx + 1:] if header_y_idx is not None else sorted_rows

    for row in data_rows:
        row_text_lower = " ".join(w["text"].lower() for w in row)

        # Skip rows that look like headers/footers
        if sum(1 for kw in HEADER_WORDS if kw in row_text_lower) >= 3:
            continue

        date_words  = [w for w in row if _is_date(w["text"])]
        amount_words_in_row = [w for w in row if _is_amount(w["text"])]

        if date_words:
            # Flush previous pending transaction
            if pending:
                txn = _finalise(pending, col_centers)
                if txn:
                    transactions.append(txn)

            no_amount_streak = 0
            date_val = parse_date(date_words[0]["text"])
            if not date_val:
                pending = None
                continue

            # Description = non-date, non-amount words to the left of amount columns
            leftmost_amount_x = min(col_centers.values())
            desc_words = [
                w["text"] for w in row
                if not _is_date(w["text"])
                and not _is_amount(w["text"])
                and float(w["x0"]) < leftmost_amount_x
            ]

            pending = {
                "date": date_val,
                "desc_parts": [" ".join(desc_words)],
                "raw_amounts": [(float(w["x0"]), w["text"]) for w in amount_words_in_row],
            }

        elif pending is not None:
            # Continuation row: accumulate description and amounts
            if amount_words_in_row:
                no_amount_streak = 0
            else:
                no_amount_streak += 1
                # Too many consecutive no-amount rows → we've entered a footer/legend
                # section; stop accumulating into the current transaction.
                if no_amount_streak > MAX_NO_AMOUNT_STREAK:
                    continue

            leftmost_amount_x = min(col_centers.values())
            desc_words = [
                w["text"] for w in row
                if not _is_amount(w["text"])
                and float(w["x0"]) < leftmost_amount_x
            ]
            if desc_words:
                pending["desc_parts"].append(" ".join(desc_words))
            pending["raw_amounts"].extend(
                (float(w["x0"]), w["text"]) for w in amount_words_in_row
            )

    # Flush last pending
    if pending:
        txn = _finalise(pending, col_centers)
        if txn:
            transactions.append(txn)

    return transactions


def _nearest_col(x: float, col_centers: dict[str, float]) -> str:
    """Return the column type whose center is closest to x."""
    return min(col_centers, key=lambda col: abs(col_centers[col] - x))


def _finalise(pending: dict, col_centers: dict[str, float]) -> Optional[dict]:
    """Resolve raw amount positions into debit/credit/balance using nearest-center."""
    if not pending.get("date"):
        return None

    debit = credit = balance = 0.0

    for x, text in pending.get("raw_amounts", []):
        amount = parse_amount(text)
        if amount is None:
            continue
        col = _nearest_col(x, col_centers)
        if col == "debit":
            debit = amount
        elif col == "credit":
            credit = amount
        elif col == "balance":
            balance = amount

    if debit == 0.0 and credit == 0.0:
        return None

    # When only 2 clusters were found (debit/balance), the left cluster may
    # contain both debit AND credit amounts. Distinguish by balance change:
    # if balance went UP compared to previous (not available here), treat as credit.
    # Fallback: leave as debit — caller can post-process if needed.

    description = clean_description(" ".join(
        part for part in pending.get("desc_parts", []) if part
    ))

    return {
        "date": pending["date"],
        "description": description,
        "debit": debit,
        "credit": credit,
        "balance": balance if balance else None,
    }
