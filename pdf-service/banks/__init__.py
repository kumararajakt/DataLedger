"""
Bank parsers module.

ARCH-01: Replaced all bank-specific parsers with a single header-mapped parser.
The table_parser automatically detects column types from header labels.
"""

from banks.table_parser import parse_table
from banks import utils

__all__ = ["parse_table", "utils"]
