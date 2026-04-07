"""
AI-based PDF parser fallback.
Extracts raw text from a PDF and sends it to an AI provider to parse transactions.
Supports Anthropic and OpenAI-compatible APIs (same providers as the Node.js server).
"""

import json
import logging
import re
import urllib.request
import urllib.error
from typing import Optional

import fitz  # pymupdf

from banks.utils import parse_date

logger = logging.getLogger(__name__)

PROMPT = """You are a financial data extraction assistant. Extract all transactions from this Indian bank statement and return them as a JSON array.

For each transaction provide:
- date: YYYY-MM-DD format
- description: transaction description (trimmed, single-spaced)
- debit: amount withdrawn/paid as a number (0 if none)
- credit: amount deposited/received as a number (0 if none)

Rules:
- Amounts must be plain numbers, no commas or currency symbols
- Debit = money out (withdrawal, payment, purchase, charge)
- Credit = money in (deposit, salary, refund, interest, reversal)
- Skip balance amounts, headers, footers, legend text
- Return ONLY a valid JSON array, no other text

Example:
[
  {"date": "2024-01-15", "description": "UPI/Swiggy payment", "debit": 250.50, "credit": 0},
  {"date": "2024-01-16", "description": "Salary credit ACME Corp", "debit": 0, "credit": 50000}
]

Bank statement text:
"""


def extract_text(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF using pymupdf."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n".join(pages)


def parse_with_ai(
    pdf_bytes: bytes,
    api_key: str,
    base_url: str,
    model: str,
    provider: str = "openai",
) -> list[dict]:
    """
    Send PDF text to an AI provider and parse the returned transactions.

    Args:
        pdf_bytes: Raw PDF bytes
        api_key: AI provider API key
        base_url: Provider base URL (e.g. https://api.anthropic.com)
        model: Model name
        provider: "anthropic" or any OpenAI-compatible provider

    Returns:
        List of transaction dicts with date/description/debit/credit/balance
    """
    text = extract_text(pdf_bytes)
    if not text.strip():
        raise ValueError("No text could be extracted from the PDF")

    # Cap at 15k chars to stay within typical token limits
    prompt_text = PROMPT + text[:15000]

    if provider == "anthropic":
        raw = _call_anthropic(api_key, base_url, model, prompt_text)
    else:
        raw = _call_openai_compat(api_key, base_url, model, prompt_text)

    return _parse_response(raw)


def _call_anthropic(api_key: str, base_url: str, model: str, prompt: str) -> str:
    base = base_url.rstrip("/")
    url = f"{base}/v1/messages"

    payload = json.dumps({
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read())

    return data["content"][0]["text"]


def _call_openai_compat(api_key: str, base_url: str, model: str, prompt: str) -> str:
    base = base_url.rstrip("/")
    url = base if base.endswith("/chat/completions") else f"{base}/chat/completions"

    payload = json.dumps({
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read())

    return data["choices"][0]["message"]["content"]


def _parse_response(raw: str) -> list[dict]:
    """Extract and validate the JSON array from the AI response."""
    match = re.search(r"\[[\s\S]*\]", raw)
    if not match:
        raise ValueError("AI response contained no JSON array")

    transactions = json.loads(match.group())
    if not isinstance(transactions, list):
        raise ValueError("AI response JSON is not an array")

    valid_date_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    results = []

    for tx in transactions:
        try:
            date_str = str(tx.get("date", "")).strip()
            if not valid_date_re.match(date_str):
                continue

            # Validate date is reasonable
            parsed = parse_date(date_str)
            if not parsed:
                continue

            debit = float(tx.get("debit") or 0)
            credit = float(tx.get("credit") or 0)
            if debit <= 0 and credit <= 0:
                continue

            description = re.sub(r"\s+", " ", str(tx.get("description", ""))).strip()

            results.append({
                "date": date_str,
                "description": description,
                "debit": abs(debit),
                "credit": abs(credit),
                "balance": None,
            })
        except Exception as e:
            logger.warning(f"Skipping invalid AI transaction {tx}: {e}")
            continue

    logger.info(f"AI parser extracted {len(results)} transactions")
    return results
