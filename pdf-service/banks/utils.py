"""
Shared utility functions for bank parsers.
"""

import re
from typing import Optional
from datetime import datetime
import pandas as pd


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse various date formats to ISO format (YYYY-MM-DD).
    
    Supported formats:
    - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    - DD/MM/YY, DD-MM-YY
    - DD Mon YYYY (e.g., "01 Jan 2024")
    - YYYY-MM-DD
    """
    if not date_str:
        return None
    
    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%d/%m/%y",
        "%d-%m-%y",
        "%d.%m.%y",
        "%d/%m/%Y %H:%M",
        "%d-%m-%Y %H:%M",
        "%Y-%m-%d",
        "%d %b %Y",  # e.g., "01 Jan 2024"
        "%d %B %Y",  # e.g., "01 January 2024"
    ]
    
    date_str = str(date_str).strip()
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    return None


def parse_amount(value: str) -> Optional[float]:
    """
    Parse amount string to float.
    Handles: "1,234.56", "INR 1,234.56", "1 234.56", "Rs 500", etc.
    """
    if not value:
        return None
    
    # Remove currency symbols and common prefixes
    cleaned = str(value).strip()
    cleaned = cleaned.replace("INR", "").replace("Rs", "").replace("₹", "")
    cleaned = cleaned.replace(",", "").strip()
    # Handle space-as-thousands-separator (e.g. "1 234.56" → "1234.56")
    import re as _re
    cleaned = _re.sub(r"(\d)\s+(\d)", r"\1\2", cleaned)
    
    # Try to parse
    try:
        amount = pd.to_numeric(cleaned, errors="coerce")
        return float(amount) if not pd.isna(amount) else None
    except Exception:
        return None


def clean_description(desc: str) -> str:
    """
    Clean transaction description.
    - Remove extra whitespace
    - Remove None values
    - Join multi-line descriptions
    """
    if not desc:
        return ""
    
    # Replace multiple whitespace with single space
    cleaned = re.sub(r"\s+", " ", str(desc))
    return cleaned.strip()


def safe_get(row: list, index: int, default: str = "") -> str:
    """Safely get a cell value from a row."""
    if index < len(row) and row[index] is not None:
        return str(row[index]).strip()
    return default


def is_date_like(value: str) -> bool:
    """Check if value looks like a date."""
    if not value:
        return False
    
    patterns = [
        r"\d{1,2}/\d{1,2}/\d{2,4}",  # DD/MM/YYYY or DD/MM/YY
        r"\d{1,2}-\d{1,2}-\d{2,4}",  # DD-MM-YYYY
        r"\d{4}-\d{2}-\d{2}",        # YYYY-MM-DD
        r"\d{1,2}\s+\w{3}\s+\d{4}",  # DD Mon YYYY
    ]
    
    for pattern in patterns:
        if re.search(pattern, str(value)):
            return True
    
    return False


def is_amount_like(value: str) -> bool:
    """Check if value looks like a monetary amount."""
    if not value:
        return False
    
    value = str(value).strip()
    
    # Remove common prefixes
    value = value.replace("INR", "").replace("Rs", "").replace("₹", "")
    value = value.replace(",", "").strip()
    
    # Check if it's a valid number
    try:
        float(value)
        return True
    except ValueError:
        pass
    
    # Check for amount patterns
    patterns = [
        r"^[\d,]+\.?\d*$",
        r"^\d+\s+\d+\.\d+$",
    ]
    
    for pattern in patterns:
        if re.match(pattern, value):
            return True
    
    return False


def is_header_row(row_text: str) -> bool:
    """Check if row appears to be a header."""
    header_keywords = [
        "date", "txn", "transaction", "description", "narration",
        "particulars", "debit", "credit", "withdrawal", "deposit",
        "balance", "amount", "dr", "cr"
    ]

    row_lower = row_text.lower()
    matches = sum(1 for kw in header_keywords if kw in row_lower)

    return matches >= 2


def validate_balance_continuity(transactions: list[dict]) -> list[str]:
    """
    FEAT-02: Validate balance continuity across transactions.
    
    Checks that: row[n].balance ≈ row[n-1].balance - row[n].debit + row[n].credit
    
    Returns:
        list[str]: List of warning messages for any gaps detected
    """
    warnings = []
    
    if len(transactions) < 2:
        return warnings
    
    # Sort transactions by date
    sorted_txns = sorted(transactions, key=lambda t: t.get("date", ""))
    
    for i in range(1, len(sorted_txns)):
        prev_txn = sorted_txns[i - 1]
        curr_txn = sorted_txns[i]
        
        prev_balance = prev_txn.get("balance")
        curr_balance = curr_txn.get("balance")
        curr_debit = curr_txn.get("debit", 0.0)
        curr_credit = curr_txn.get("credit", 0.0)

        # Skip if balances are not available
        if prev_balance is None or curr_balance is None:
            continue

        # balance[i] = balance[i-1] - debit[i] + credit[i]
        expected_balance = prev_balance - curr_debit + curr_credit
        
        # Allow small floating point differences
        if abs(curr_balance - expected_balance) > 0.01:
            warnings.append(
                f"Balance gap detected between {prev_txn.get('date', 'unknown')} "
                f"and {curr_txn.get('date', 'unknown')} — some transactions may be missing"
            )
    
    return warnings
