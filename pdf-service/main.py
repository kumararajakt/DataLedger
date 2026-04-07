"""
PDF Parsing Microservice - FastAPI Application
Primary endpoint for parsing bank statement PDFs using pdfplumber and camelot.
"""

import os
import logging
from typing import Optional
import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from parser import parse_pdf

# Configure logging — third-party libraries stay at WARNING, only app code uses LOG_LEVEL
_log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
for _name in ("__main__", "parser", "banks.table_parser", "banks.utils", "ai_parser"):
    logging.getLogger(_name).setLevel(_log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PDF Parsing Service",
    description="Microservice for parsing bank statement PDFs",
    version="1.0.0"
)

# Configuration
ENABLE_OCR = os.getenv("ENABLE_OCR", "false").lower() == "true"
MAX_PDF_SIZE = 20 * 1024 * 1024  # 20 MB


class ParseResponse(BaseModel):
    transactions: list[dict]
    bank: Optional[str] = None
    method: Optional[str] = None
    page_count: Optional[int] = None
    # FEAT-04: Additional parsing stats
    pages_with_transactions: Optional[int] = None
    rows_skipped: Optional[int] = None
    date_range: Optional[dict] = None
    # FEAT-02: Balance validation warnings
    warnings: Optional[list[str]] = None
    error: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/parse")
async def parse_pdf_endpoint(
    file: UploadFile = File(..., description="PDF file to parse"),
    bank_hint: Optional[str] = Form(None, description="Override bank detection"),
    # AI fallback settings — forwarded from the Node.js server when the user has AI configured
    ai_provider: Optional[str] = Form(None, description="AI provider: anthropic | openai | openrouter | local"),
    ai_api_key: Optional[str] = Form(None, description="AI provider API key"),
    ai_base_url: Optional[str] = Form(None, description="AI provider base URL"),
    ai_model: Optional[str] = Form(None, description="AI model name"),
):
    """
    Parse a bank statement PDF and extract transactions.

    Structured parsing (pdfplumber → camelot) runs first.
    If it returns 0 transactions AND AI settings are provided, AI parsing is used as fallback.
    """
    pdf_bytes = await file.read()

    if not (file.content_type == "application/pdf" or pdf_bytes[:4] == b"%PDF"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse(status_code=413, content={
            "transactions": [], "error": f"PDF exceeds {MAX_PDF_SIZE // (1024 * 1024)} MB limit"
        })

    if len(pdf_bytes) == 0:
        return JSONResponse(status_code=400, content={"transactions": [], "error": "Empty PDF file"})

    # Check for password-protected PDFs
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if doc.is_encrypted:
            doc.close()
            return JSONResponse(status_code=400, content={
                "transactions": [],
                "error": "PDF is password-protected. Please provide an unlocked statement."
            })
        doc.close()
    except Exception as e:
        if "password" in str(e).lower() or "encrypted" in str(e).lower():
            return JSONResponse(status_code=400, content={
                "transactions": [],
                "error": "PDF is password-protected. Please provide an unlocked statement."
            })
        logger.warning(f"Error checking PDF encryption: {e}")

    try:
        result = parse_pdf(pdf_bytes, bank_hint, ENABLE_OCR)

        # AI fallback: if structured parsing found nothing and AI settings are available
        if not result.get("transactions") and ai_api_key and ai_base_url and ai_model:
            logger.info("Structured parsing found 0 transactions — trying AI fallback")
            try:
                from ai_parser import parse_with_ai
                ai_transactions = parse_with_ai(
                    pdf_bytes,
                    api_key=ai_api_key,
                    base_url=ai_base_url,
                    model=ai_model,
                    provider=ai_provider or "openai",
                )
                if ai_transactions:
                    result["transactions"] = ai_transactions
                    result["method"] = "ai"
                    logger.info(f"AI fallback extracted {len(ai_transactions)} transactions")
            except Exception as ai_err:
                logger.warning(f"AI fallback failed: {ai_err}")

        return JSONResponse(content=result)

    except Exception as e:
        logger.exception("Error parsing PDF")
        return JSONResponse(status_code=500, content={"transactions": [], "error": str(e)})


@app.post("/debug")
async def debug_pdf_endpoint(
    file: UploadFile = File(..., description="PDF file to inspect"),
):
    """
    Debug endpoint — returns raw pdfplumber extraction data without parsing.

    Useful for diagnosing why /parse returns 0 transactions:
    - tables: what extract_table() sees per page
    - words: first 30 word tokens per page (with x/y positions)
    - text: raw plain text per page
    """
    pdf_bytes = await file.read()
    if not pdf_bytes or pdf_bytes[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="File must be a PDF")

    import io
    import pdfplumber

    pages_info = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                table = page.extract_table()
                words = page.extract_words(x_tolerance=3, y_tolerance=3)
                text = page.extract_text() or ""

                pages_info.append({
                    "page": page_idx + 1,
                    "table_rows": len(table) if table else 0,
                    "table_header": table[0] if table else None,
                    "table_sample": table[1:4] if table and len(table) > 1 else [],
                    "word_count": len(words),
                    "words_sample": [
                        {"text": w["text"], "x0": round(w["x0"]), "top": round(w["top"])}
                        for w in words[:40]
                    ],
                    "text_sample": text[:500],
                })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

    return JSONResponse(content={"pages": pages_info})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)
