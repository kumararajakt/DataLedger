# PDF Parsing Microservice

Python-based PDF parsing service for bank statements using `pdfplumber` and `camelot`.

## Features

- **Bank-specific parsers** for ICICI, HDFC, SBI, and Axis banks
- **Generic parser** for unknown bank formats
- **OCR support** (opt-in) for scanned PDFs using PaddleOCR
- **Fallback chain**: pdfplumber → camelot → OCR (if enabled)

## Quick Start

### Using Docker (Recommended)

```bash
# Start all services including PDF service
docker-compose up -d

# Check health
curl http://localhost:5001/health

# View logs
docker-compose logs -f pdf-service
```

### Local Development

#### Using uv (Recommended)

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
cd pdf-service
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt

# Start service
uvicorn main:app --reload --port 5001

# Test it
curl -F "file=@/home/kumar/Projects/personal-finance-tracker/OpTransactionHistory01-04-2026.pdf-20-05-19.pdf" http://localhost:5001/parse | jq .
```

#### Using standard Python

```bash
# Create virtual environment
cd pdf-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start service
uvicorn main:app --reload --port 5001

# Test it
curl -F "file=@sample_hdfc.pdf" http://localhost:5001/parse | jq .
```

## API Endpoints

### `POST /parse`

Parse a bank statement PDF.

**Request:**
- `file` (multipart/form-data): PDF file
- `bank_hint` (optional): Override bank detection (`icici`, `hdfc`, `sbi`, `axis`)

**Response:**
```json
{
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "UPI/SWIGGY/merchant",
      "debit": 450.00,
      "credit": 0.00,
      "balance": 12500.00
    }
  ],
  "bank": "hdfc",
  "method": "pdfplumber",
  "page_count": 4,
  "error": null
}
```

**Method values:**
- `pdfplumber`: Primary table extraction
- `camelot`: Fallback for complex tables
- `ocr`: OCR-based extraction (scanned PDFs)
- `generic`: Auto-detected column structure

### `GET /health`

Health check endpoint.

```json
{ "status": "ok" }
```

## Supported Bank Formats

| Bank | Header Keywords | Notes |
|------|-----------------|-------|
| ICICI | "Transaction Date", "Remarks" | Multi-line remarks handling |
| HDFC | "Narration", "Withdrawal Amt." | Header starts at row 22 |
| SBI | "Txn Date", "Debit", "Credit" | Simple table format |
| Axis | "Tran Date", "Particulars" | Credit/Debit columns reversed |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_OCR` | `false` | Enable OCR for scanned PDFs (adds ~500MB) |
| `PORT` | `5001` | Service port |

## Architecture

```
Incoming PDF
    │
    ▼
┌─────────────────┐
│ Detect: text    │
│ or scanned?     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  TEXT     SCANNED
    │         │
    ▼         ▼
┌─────────┐ ┌──────────────┐
│pdfplumber│ │pdf2image +   │
│ primary  │ │PaddleOCR     │
└────┬────┘ └──────┬───────┘
     │             │
     │ 0 rows?     │
     ▼             │
┌─────────┐        │
│ camelot │        │
│ fallback│        │
└────┬────┘        │
     └──────┬──────┘
            │
            ▼
     ┌──────────────┐
     │ Bank Detection│
     │ (text search) │
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ Bank-specific│
     │ parser       │
     └──────┬───────┘
            │
            ▼
     Normalize & return JSON
```

## Dependencies

- **pdfplumber**: Primary table extraction
- **camelot-py**: Fallback table extraction
- **pymupdf**: PDF type detection (text vs scanned)
- **pandas**: Amount parsing and normalization
- **PaddleOCR** (optional): OCR for scanned PDFs

## Troubleshooting

### No transactions extracted

1. Check if PDF is a scanned image (not text-based)
2. Enable OCR: set `ENABLE_OCR=true` in docker-compose.yml
3. Verify bank format is supported

### Service won't start

```bash
# Check logs
docker-compose logs pdf-service

# Rebuild
docker-compose build pdf-service
docker-compose up -d pdf-service
```

### OCR is slow

OCR adds ~500MB and increases processing time. Only enable if you need scanned PDF support:

```yaml
environment:
  - ENABLE_OCR=false  # Default: disabled
```

## Testing

```bash
# Health check
curl http://localhost:5001/health

# Parse HDFC PDF
curl -F "file=@test_hdfc.pdf" http://localhost:5001/parse | jq .

# Parse with bank hint
curl -F "file=@test_icici.pdf" \
     -F "bank_hint=icici" \
     http://localhost:5001/parse | jq .
```

## Integration with Node.js Server

The Node.js server automatically calls this service first when parsing PDFs:

1. **Step 1**: Python PDF service (pdfplumber)
2. **Step 2**: Node.js structured parser (pdfjs-dist)
3. **Step 3**: AI fallback (if enabled)

If the Python service is unavailable, the server silently falls back to Node.js parsing.

## License

MIT License
