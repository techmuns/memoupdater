import type { ExtractionResult } from "@shared/types";
import { characterCount, wordCount } from "./text";
import { extractionSupported, extractionPlannedNext, getExtension, mimeForFile } from "./fileMeta";
import { extractPdfText } from "./extractPdf";

export async function extractText(file: File): Promise<ExtractionResult> {
  const ext = getExtension(file.name);

  if (ext === "pdf") return extractPdfText(file);

  if (ext === "txt" || ext === "md" || ext === "markdown") {
    const text = await file.text();
    const clean = text.replace(/\r\n/g, "\n");
    return {
      status: clean.trim().length > 0 ? "success" : "unsupported",
      text: clean,
      characterCount: characterCount(clean),
      wordCount: wordCount(clean),
      warnings: clean.trim().length === 0 ? ["File is empty."] : [],
      source: {
        filename: file.name,
        sizeBytes: file.size,
        mime: mimeForFile(file),
        extension: ext,
      },
      extractedAt: new Date().toISOString(),
    };
  }

  if (extractionPlannedNext(ext)) {
    return {
      status: "unsupported",
      text: "",
      characterCount: 0,
      wordCount: 0,
      warnings: [
        `${ext.toUpperCase()} extraction is coming next. Phase 2 supports .txt, .md, and .pdf.`,
      ],
      source: {
        filename: file.name,
        sizeBytes: file.size,
        mime: mimeForFile(file),
        extension: ext,
      },
      extractedAt: new Date().toISOString(),
    };
  }

  if (!extractionSupported(ext)) {
    return {
      status: "unsupported",
      text: "",
      characterCount: 0,
      wordCount: 0,
      warnings: [
        `.${ext || "(no extension)"} is not a supported format. Phase 2 supports .txt, .md, and .pdf.`,
      ],
      source: {
        filename: file.name,
        sizeBytes: file.size,
        mime: mimeForFile(file),
        extension: ext,
      },
      extractedAt: new Date().toISOString(),
    };
  }

  // Fallback shouldn't normally hit
  return {
    status: "error",
    text: "",
    characterCount: 0,
    wordCount: 0,
    warnings: [],
    errorMessage: "Unhandled file type — extension was not routed.",
    source: {
      filename: file.name,
      sizeBytes: file.size,
      mime: mimeForFile(file),
      extension: ext,
    },
    extractedAt: new Date().toISOString(),
  };
}
