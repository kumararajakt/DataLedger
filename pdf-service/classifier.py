"""
Rule-based TF-IDF classifier + regex note generator for bank transactions.
No LLM required — uses character n-gram TF-IDF cosine similarity.
"""

import re
import logging
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.30

# Ordered list of (compiled regex, note formatter fn) for common Indian bank patterns
_NOTE_PATTERNS = [
    # UPI: UPI/REF/MERCHANT/... or UPI-REF-MERCHANT-...
    (
        re.compile(r'\bUPI[/\-][A-Z0-9]+[/\-]([A-Za-z0-9&. ]+?)(?:[/\-]|$)', re.IGNORECASE),
        lambda m: f"UPI payment to {_title(m.group(1))}",
    ),
    # ATM withdrawal
    (
        re.compile(r'\bATM\b', re.IGNORECASE),
        lambda _: "ATM cash withdrawal",
    ),
    # NEFT with party name after FROM/TO or slash
    (
        re.compile(r'\bNEFT\b.*?(?:FROM|TO|/)\s*([A-Za-z][A-Za-z ]{2,})', re.IGNORECASE),
        lambda m: f"NEFT transfer — {_title(m.group(1))}",
    ),
    # IMPS
    (
        re.compile(r'\bIMPS\b.*?(?:\d{6,}[/\s]+)?([A-Za-z][A-Za-z ]{2,})', re.IGNORECASE),
        lambda m: f"IMPS transfer — {_title(m.group(1))}",
    ),
    # RTGS
    (
        re.compile(r'\bRTGS\b', re.IGNORECASE),
        lambda _: "RTGS fund transfer",
    ),
    # POS purchase at merchant
    (
        re.compile(r'\bPOS\b.*?(?:AT|@)\s+([A-Za-z][A-Za-z0-9 &]{2,})', re.IGNORECASE),
        lambda m: f"Purchase at {_title(m.group(1))}",
    ),
    # Salary / SAL credit
    (
        re.compile(r'\b(?:SALARY|SAL)\b', re.IGNORECASE),
        lambda _: "Salary credit",
    ),
    # Interest
    (
        re.compile(r'\bINTEREST\b', re.IGNORECASE),
        lambda _: "Interest credited",
    ),
    # EMI / Loan
    (
        re.compile(r'\b(?:EMI|LOAN INSTALLMENT)\b', re.IGNORECASE),
        lambda _: "EMI / loan payment",
    ),
    # Mutual fund / SIP
    (
        re.compile(r'\b(?:MUTUAL FUND|SIP)\b', re.IGNORECASE),
        lambda _: "Mutual fund / SIP investment",
    ),
]


def _title(s: str) -> str:
    return s.strip().title()


class TransactionClassifier:
    def __init__(self, rules: list[dict]):
        """
        rules: list of {"keyword": str, "category_name": str}
        Fits a char n-gram TF-IDF model on keywords for cosine similarity matching.
        """
        if not rules:
            self._ready = False
            return

        keywords = [r["keyword"].lower() for r in rules]
        self.labels = [r["category_name"] for r in rules]
        self.vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            min_df=1,
            sublinear_tf=True,
        )
        self.matrix = self.vectorizer.fit_transform(keywords)
        self._ready = True
        logger.debug(f"Classifier fitted on {len(rules)} rules")

    def classify(self, description: str) -> tuple[str | None, float]:
        """Return (category_name, confidence) if best match >= threshold, else (None, 0.0)."""
        if not self._ready or not description:
            return None, 0.0

        vec = self.vectorizer.transform([description.lower()])
        sims = cosine_similarity(vec, self.matrix)[0]
        best_idx = int(np.argmax(sims))
        best_score = float(sims[best_idx])

        if best_score >= CONFIDENCE_THRESHOLD:
            return self.labels[best_idx], best_score
        return None, 0.0

    def generate_note(self, description: str) -> str | None:
        """Extract a short human-readable note using regex patterns. Returns None if no pattern matches."""
        desc = description.strip()
        for pattern, formatter in _NOTE_PATTERNS:
            m = pattern.search(desc)
            if m:
                try:
                    return formatter(m)
                except Exception:
                    continue
        return None
