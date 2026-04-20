import { normalizeDate, type ParsedRow } from "./bankFormats";
import FormData from "form-data";
import axios from "axios";

// Python PDF Service URL (from environment)
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || "http://localhost:5001";

/**
 * Parse a PDF buffer by sending it to the Python pdf-service.
 * The Python service handles all parsing (structured, AI, etc.).
 * Returns ParsedRow[] from the Python service response.
 */
export async function parsePdfBuffer(
  buffer: Buffer,
  rules?: Array<{ keyword: string; category_name: string }>
): Promise<ParsedRow[]> {
  try {
    const formData = new FormData();
    formData.append("file", buffer, {
      filename: "statement.pdf",
      contentType: "application/pdf",
    });
    if (rules && rules.length > 0) {
      formData.append("rules", JSON.stringify(rules));
    }

    const response = await axios.post(`${PDF_SERVICE_URL}/parse`, formData, {
      headers: formData.getHeaders(),
      timeout: 90000, // 90s to allow time for AI fallback within Python service
      validateStatus: (status) => status < 500,
    });

    if (!response.data.transactions?.length) {
      throw new Error(
        "PDF service returned no transactions. " +
          "Ensure this is a digital bank statement, not a scanned copy."
      );
    }

    const transactions: ParsedRow[] = response.data.transactions.map((t: any) => ({
      date: normalizeDate(t.date) ?? t.date,
      description: t.description || "",
      debit: t.debit || 0,
      credit: t.credit || 0,
      rawRow: {
        raw: t.description || "",
        method: response.data.method ?? "pdf-service",
        bank: response.data.bank ?? "unknown",
      },
      ...(t.suggested_category ? { suggestedCategoryName: t.suggested_category } : {}),
      ...(t.notes ? { notes: t.notes } : {}),
    }));

    console.log(
      `[PDF parser] Extracted ${transactions.length} transactions via ${response.data.method}`
    );
    return transactions;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || error.message;
      throw new Error(
        `PDF service request failed (HTTP ${status ?? "unknown"}): ${detail}`
      );
    }
    throw error;
  }
}

export interface PdfParseOptions {
  /** Unused — kept for API compatibility. All parsing is done by pdf-service. */
  useAiFallback?: boolean;
}
