"""
OCR Pipeline for Scanned PDFs

Uses pdf2image to convert PDF pages to images,
then PaddleOCR to extract text with bounding boxes.
Transactions are reconstructed by grouping text by Y-coordinate.

NOTE: This module is opt-in via ENABLE_OCR environment variable.
PaddleOCR adds ~500MB to the Docker image.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def parse_with_ocr(pdf_bytes: bytes) -> list[dict]:
    """
    Parse scanned PDF using OCR.
    
    Process:
    1. Convert PDF pages to images (300 DPI)
    2. Run PaddleOCR on each image
    3. Group text blocks by Y-coordinate to reconstruct rows
    4. Parse rows into transactions
    
    Returns:
        list[dict]: Extracted transactions
    """
    try:
        from pdf2image import convert_from_bytes
        from paddleocr import PaddleOCR
        
        # Initialize OCR (English + numeric)
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            show_log=False
        )
        
        # Convert PDF to images
        logger.info("Converting PDF to images...")
        images = convert_from_bytes(pdf_bytes, dpi=300)
        logger.info(f"Converted {len(images)} pages")
        
        all_transactions = []
        
        for page_idx, image in enumerate(images):
            logger.info(f"Processing page {page_idx + 1}/{len(images)}")
            
            # Get image dimensions for debit/credit classification
            img_width = image.width
            
            # Run OCR
            result = ocr.ocr(image, cls=True)
            
            if not result or not result[0]:
                continue
            
            # Extract text with bounding boxes
            text_blocks = []
            for line in result[0]:
                bbox = line[0]  # [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                text = line[1][0]  # Text content
                confidence = line[1][1]  # Confidence score
                
                # Get bounding box coordinates
                x1 = min(p[0] for p in bbox)
                y1 = min(p[1] for p in bbox)
                x2 = max(p[0] for p in bbox)
                y2 = max(p[1] for p in bbox)
                
                text_blocks.append({
                    "text": text,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "confidence": confidence
                })
            
            # Group text blocks into rows by Y-coordinate
            rows = group_by_y_coordinate(text_blocks)
            
            # Parse rows into transactions
            for row in rows:
                transaction = parse_ocr_row(row, img_width)
                if transaction:
                    all_transactions.append(transaction)
        
        logger.info(f"OCR extracted {len(all_transactions)} transactions")
        return all_transactions
    
    except ImportError as e:
        logger.error(f"OCR dependencies not installed: {e}")
        return []
    
    except Exception as e:
        logger.exception(f"OCR parsing failed: {e}")
        return []


def group_by_y_coordinate(text_blocks: list[dict], tolerance: int = 15) -> list[list[dict]]:
    """
    Group text blocks by Y-coordinate to form rows.
    
    Args:
        text_blocks: List of text blocks with bounding boxes
        tolerance: Y-coordinate tolerance for grouping (pixels)
                   IMP-09 FIX: Increased from 10 to 15 as safer default
    
    Returns:
        list[list[dict]]: Grouped rows of text blocks
    """
    if not text_blocks:
        return []
    
    # Sort by Y-coordinate (top to bottom)
    sorted_blocks = sorted(text_blocks, key=lambda b: b["y1"])
    
    rows = []
    current_row = [sorted_blocks[0]]
    current_y = sorted_blocks[0]["y1"]
    
    for block in sorted_blocks[1:]:
        # Check if block is on the same row
        if abs(block["y1"] - current_y) <= tolerance:
            current_row.append(block)
        else:
            # Sort current row by X-coordinate (left to right) and add to rows
            current_row.sort(key=lambda b: b["x1"])
            rows.append(current_row)
            current_row = [block]
            current_y = block["y1"]
    
    # Add last row
    if current_row:
        current_row.sort(key=lambda b: b["x1"])
        rows.append(current_row)
    
    return rows


def parse_ocr_row(row: list[dict], page_width: int) -> Optional[dict]:
    """
    Parse a row of OCR text blocks into a transaction.
    
    BUG-06 FIX: Use X-position to determine debit vs credit instead of order.
    Amounts on the left side of center → debit
    Amounts on the right side of center → credit
    
    Expected format (left to right):
    - Date
    - Description (may span multiple blocks)
    - Debit amount (left side)
    - Credit amount (right side)
    - Balance (optional, far right)
    """
    from banks.utils import parse_date, parse_amount, is_date_like, is_amount_like
    
    if len(row) < 3:
        return None
    
    # Extract text from blocks
    texts = [block["text"].strip() for block in row]
    
    # Try to identify columns by content and position
    date_idx = None
    amount_blocks = []  # (index, amount_value, x_position)
    description_parts = []
    
    center_x = page_width / 2
    
    for i, block in enumerate(row):
        text = block["text"].strip()
        x_center = (block["x1"] + block["x2"]) / 2
        
        # Check for date
        if is_date_like(text) and date_idx is None:
            date_idx = i
            continue
        
        # Check for amount
        if is_amount_like(text):
            amount = parse_amount(text)
            if amount:
                amount_blocks.append({
                    "idx": i,
                    "amount": amount,
                    "x": x_center,
                    "is_right": x_center > center_x
                })
        else:
            description_parts.append(text)
    
    # Need at least a date and one amount
    if date_idx is None or len(amount_blocks) == 0:
        return None
    
    # Parse date
    date_str = texts[date_idx]
    parsed_date = parse_date(date_str)
    if not parsed_date:
        return None
    
    # Build description
    description = " ".join(description_parts)
    import re
    description = re.sub(r"\s+", " ", description).strip()
    
    # BUG-06 FIX: Assign debit/credit based on X position
    # Left side amounts = debit, Right side amounts = credit
    debit = 0.0
    credit = 0.0
    
    for amt in amount_blocks:
        if amt["is_right"]:
            # Amount on right side is credit
            if credit == 0.0:
                credit = amt["amount"]
        else:
            # Amount on left side is debit
            if debit == 0.0:
                debit = amt["amount"]
    
    # If only one amount found and we couldn't determine side, use heuristics
    if debit == 0.0 and credit == 0.0 and len(amount_blocks) == 1:
        # Single amount: assume it's the transaction amount
        # Check for CR/DR keywords in description
        desc_lower = description.lower()
        if any(kw in desc_lower for kw in ["cr", "credit", "deposit"]):
            credit = amount_blocks[0]["amount"]
        else:
            debit = amount_blocks[0]["amount"]
    
    # Skip if no valid amount
    if debit == 0.0 and credit == 0.0:
        return None
    
    return {
        "date": parsed_date,
        "description": description,
        "debit": float(debit),
        "credit": float(credit),
        "balance": None  # Balance often not available in OCR
    }
