import type { ExtractionResult } from "@shared/types";
import { characterCount, wordCount } from "./text";
import { getExtension, mimeForFile } from "./fileMeta";

const MAX_PAGES = 100;

interface PdfTextItem {
  str?: string;
}

interface PdfTextContent {
  items: PdfTextItem[];
}

interface PdfPage {
  getTextContent(): Promise<PdfTextContent>;
}

interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

export async function extractPdfText(file: File): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const buf = await file.arrayBuffer();

  try {
    const pdfjs = await import("pdfjs-dist");
    const workerSrc = (
      await import("pdfjs-dist/build/pdf.worker.mjs?url")
    ).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

    const loadingTask = pdfjs.getDocument({ data: buf });
    try {
      const doc = (await loadingTask.promise) as unknown as PdfDocument;

      const totalPages = doc.numPages;
      const pagesToRead = Math.min(totalPages, MAX_PAGES);
      if (totalPages > MAX_PAGES) {
        warnings.push(
          `PDF has ${totalPages} pages; Phase 2 only reads the first ${MAX_PAGES}.`,
        );
      }

      const pageChunks: string[] = [];
      for (let i = 1; i <= pagesToRead; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => (typeof item.str === "string" ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pageChunks.push(pageText);
      }

      const text = pageChunks.join("\n\n").trim();

      if (text.length === 0) {
        return {
          status: "unsupported",
          text: "",
          characterCount: 0,
          wordCount: 0,
          pageCount: totalPages,
          warnings: [
            ...warnings,
            "PDF returned no extractable text — likely a scanned / image-only document. OCR is not supported in Phase 2.",
          ],
          source: sourceFor(file),
          extractedAt: new Date().toISOString(),
        };
      }

      const status: ExtractionResult["status"] =
        warnings.length > 0 ? "partial" : "success";

      return {
        status,
        text,
        characterCount: characterCount(text),
        wordCount: wordCount(text),
        pageCount: totalPages,
        warnings,
        source: sourceFor(file),
        extractedAt: new Date().toISOString(),
      };
    } finally {
      // Release the pdf.js worker-side document + the page buffers on every
      // exit path (success, empty-text return, or a throw) so repeated
      // uploads don't accumulate detached documents in the worker.
      await loadingTask.destroy();
    }
  } catch (err) {
    return {
      status: "error",
      text: "",
      characterCount: 0,
      wordCount: 0,
      warnings,
      errorMessage:
        err instanceof Error ? err.message : "Unknown PDF extraction error",
      source: sourceFor(file),
      extractedAt: new Date().toISOString(),
    };
  }
}

function sourceFor(file: File): ExtractionResult["source"] {
  return {
    filename: file.name,
    sizeBytes: file.size,
    mime: mimeForFile(file),
    extension: getExtension(file.name),
  };
}
