"""
Standalone script to parse a bank statement PDF using opendataloader-pdf.
Usage: python odl_parse.py <path-to-pdf>

Requires: pip install opendataloader-pdf
          Java 11+ installed (java -version to check)
"""

import sys
import json
import re
import tempfile
import os
from pathlib import Path

try:
    import opendataloader_pdf
except ImportError:
    print(json.dumps({"error": "opendataloader-pdf not installed. Run: pip install opendataloader-pdf"}))
    sys.exit(1)


# ── Column keyword matching ───────────────────────────────────────────────────

_COL_KEYWORDS = {
    "date":        ["transaction date", "txn date", "tran date", "value date", "date"],
    "description": ["transaction remarks", "remarks", "narration", "particulars", "description", "details"],
    "debit":       ["withdrawal amount", "withdrawal (inr)", "withdrawal amt", "debit amount", "debit", "dr"],
    "credit":      ["deposit amount", "deposit (inr)", "deposit amt", "credit amount", "credit", "cr"],
    "balance":     ["closing balance", "available balance", "balance"],
}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).lower()).strip()


def _match_col_type(header_cell: str) -> str | None:
    cell = _norm(header_cell)
    for col_type, keywords in _COL_KEYWORDS.items():
        if any(kw in cell or (len(cell) >= 3 and cell in kw) for kw in keywords):
            return col_type
    return None


def _parse_amount(s: str) -> float | None:
    s = re.sub(r"[₹,\s]", "", str(s)).strip()
    if not s or s in ("-", "—", "nil", "n/a"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _parse_date(s: str) -> str | None:
    s = str(s).strip()
    if not s:
        return None
    patterns = [
        (r"(\d{2})[/-](\d{2})[/-](\d{4})", lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}"),
        (r"(\d{4})[/-](\d{2})[/-](\d{2})", lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}"),
        (r"(\d{2})\s+(\w{3})\s+(\d{4})", lambda m: _month_str(m)),
        (r"(\d{2})-(\w{3})-(\d{4})", lambda m: _month_str(m)),
    ]
    for pattern, formatter in patterns:
        match = re.search(pattern, s, re.IGNORECASE)
        if match:
            try:
                return formatter(match)
            except Exception:
                pass
    return None


_MONTHS = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

def _month_str(m) -> str:
    month = _MONTHS.get(m.group(2).lower()[:3], "??")
    return f"{m.group(3)}-{month}-{m.group(1)}"


# ── Table content parsers ─────────────────────────────────────────────────────

def _extract_from_2d_table(rows: list[list]) -> list[dict]:
    """Parse when table content is a 2D list of rows."""
    if not rows or len(rows) < 2:
        return []

    # Find header row (first row with column keyword matches)
    header_idx = None
    col_map: dict[int, str] = {}
    for i, row in enumerate(rows[:5]):
        assigned: set[str] = set()
        candidate: dict[int, str] = {}
        for j, cell in enumerate(row):
            col_type = _match_col_type(str(cell))
            if col_type and col_type not in assigned:
                candidate[j] = col_type
                assigned.add(col_type)
        if len(candidate) >= 2:
            header_idx = i
            col_map = candidate
            break

    if header_idx is None:
        return []

    transactions = []
    for row in rows[header_idx + 1:]:
        if not row or all(str(c).strip() in ("", "-") for c in row):
            continue
        txn: dict = {}
        for col_idx, col_type in col_map.items():
            if col_idx >= len(row):
                continue
            cell = str(row[col_idx]).strip()
            if col_type == "date":
                txn["date"] = _parse_date(cell) or cell
            elif col_type == "description":
                txn["description"] = cell
            elif col_type == "debit":
                txn["debit"] = _parse_amount(cell) or 0.0
            elif col_type == "credit":
                txn["credit"] = _parse_amount(cell) or 0.0
            elif col_type == "balance":
                txn["balance"] = _parse_amount(cell)

        if txn.get("date") and (txn.get("debit") or txn.get("credit")):
            txn.setdefault("debit", 0.0)
            txn.setdefault("credit", 0.0)
            transactions.append(txn)

    return transactions


def _extract_from_markdown_table(md: str) -> list[dict]:
    """Parse when table content is a markdown string."""
    lines = [l.strip() for l in md.strip().splitlines() if l.strip().startswith("|")]
    if len(lines) < 2:
        return []

    def split_row(line: str) -> list[str]:
        return [c.strip() for c in line.strip("|").split("|")]

    header = split_row(lines[0])
    col_map: dict[int, str] = {}
    assigned: set[str] = set()
    for i, cell in enumerate(header):
        col_type = _match_col_type(cell)
        if col_type and col_type not in assigned:
            col_map[i] = col_type
            assigned.add(col_type)

    if len(col_map) < 2:
        return []

    data_lines = [l for l in lines[1:] if not re.match(r"^\|[-: |]+\|$", l)]
    transactions = []
    for line in data_lines:
        cells = split_row(line)
        txn: dict = {}
        for col_idx, col_type in col_map.items():
            if col_idx >= len(cells):
                continue
            cell = cells[col_idx]
            if col_type == "date":
                txn["date"] = _parse_date(cell) or cell
            elif col_type == "description":
                txn["description"] = cell
            elif col_type == "debit":
                txn["debit"] = _parse_amount(cell) or 0.0
            elif col_type == "credit":
                txn["credit"] = _parse_amount(cell) or 0.0
            elif col_type == "balance":
                txn["balance"] = _parse_amount(cell)

        if txn.get("date") and (txn.get("debit") or txn.get("credit")):
            txn.setdefault("debit", 0.0)
            txn.setdefault("credit", 0.0)
            transactions.append(txn)

    return transactions


# ── Main extraction logic ─────────────────────────────────────────────────────

def extract_transactions(elements: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Walk opendataloader JSON elements, find table elements,
    and extract transactions from any that look like bank statements.
    Returns (transactions, raw_tables) for debugging.
    """
    transactions: list[dict] = []
    raw_tables: list[dict] = []

    for el in elements:
        if el.get("type") != "table":
            continue

        content = el.get("content", "")
        raw_tables.append({"page": el.get("page number"), "content_preview": str(content)[:200]})

        found: list[dict] = []
        if isinstance(content, list):
            found = _extract_from_2d_table(content)
        elif isinstance(content, str):
            found = _extract_from_markdown_table(content)

        transactions.extend(found)

    return transactions, raw_tables


def parse_pdf(pdf_path: str) -> dict:
    pdf_path = str(Path(pdf_path).resolve())
    if not os.path.exists(pdf_path):
        return {"error": f"File not found: {pdf_path}"}

    with tempfile.TemporaryDirectory() as tmp_dir:
        try:
            opendataloader_pdf.convert(
                input_path=[pdf_path],
                output_dir=tmp_dir,
                format="json",
            )
        except Exception as e:
            return {"error": f"opendataloader convert failed: {e}"}

        json_files = list(Path(tmp_dir).glob("**/*.json"))
        if not json_files:
            return {"error": "opendataloader produced no output files", "output_dir_contents": os.listdir(tmp_dir)}

        all_elements: list[dict] = []
        for jf in json_files:
            try:
                data = json.loads(jf.read_text())
                # opendataloader JSON is either a list of elements or {"elements": [...]}
                if isinstance(data, list):
                    all_elements.extend(data)
                elif isinstance(data, dict):
                    all_elements.extend(data.get("elements", data.get("content", [])))
            except Exception as e:
                return {"error": f"Failed to read output JSON: {e}"}

        transactions, raw_tables = extract_transactions(all_elements)

        return {
            "source": pdf_path,
            "total_elements": len(all_elements),
            "tables_found": len(raw_tables),
            "transactions": transactions,
            "transaction_count": len(transactions),
            # Uncomment below to debug raw table content:
            # "raw_tables": raw_tables,
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python odl_parse.py <path-to-bank-statement.pdf>")
        sys.exit(1)

    result = parse_pdf(sys.argv[1])
    print(json.dumps(result, indent=2, ensure_ascii=False))
