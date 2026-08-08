import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// Configure the PDF.js worker using Vite's URL import
GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const MAX_TEXT_LENGTH = 50000;

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  wasTruncated: boolean;
}

export async function extractTextFromPdf(
  file: File
): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;
  const pageTexts: string[] = [];
  let totalLength = 0;

  for (let i = 1; i <= pageCount; i++) {
    if (totalLength >= MAX_TEXT_LENGTH) break;

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    if (totalLength + pageText.length > MAX_TEXT_LENGTH) {
      const remaining = MAX_TEXT_LENGTH - totalLength;
      pageTexts.push(pageText.slice(0, remaining));
      totalLength = MAX_TEXT_LENGTH;
    } else {
      pageTexts.push(pageText);
      totalLength += pageText.length;
    }
  }

  const text = pageTexts.join("\n\n").trim();

  if (!text) {
    throw new Error(
      "Could not read text from this PDF. The file may be scanned or image-based."
    );
  }

  return {
    text,
    pageCount,
    wasTruncated: totalLength >= MAX_TEXT_LENGTH,
  };
}