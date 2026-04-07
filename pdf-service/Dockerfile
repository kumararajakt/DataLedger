# PDF Parsing Microservice Dockerfile
# Based on Python 3.12-slim with dependencies for pdfplumber and camelot

FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# - ghostscript: Required by camelot for PDF processing
# - libgl1: OpenGL for image rendering (camelot-opencv)
# - libglib2.0-0: Required by various libraries
# - curl: For health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
# OCR dependencies are commented out by default (opt-in)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# IMP-07 FIX: Run with 2 workers to handle concurrent requests
# Large PDFs can block, so multiple workers prevent request starvation
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "2"]
