/**
 * PDF text extractor. Uses pdf-parse on the server.
 *
 * pdf-parse has a long-standing bug where its top-level index.js detects
 * "no parent module" via `!module.parent` and tries to read a hard-coded
 * test PDF (./test/data/05-versions-space.pdf). In Vercel's serverless
 * bundling that path doesn't exist and the FUNCTION CRASHES AT IMPORT.
 *
 * The fix is two-fold:
 *   1. Import the inner implementation file (`pdf-parse/lib/pdf-parse.js`)
 *      directly — this skips the test-runner index.js entirely.
 *   2. Do it inside the function (true lazy import) so a missing module
 *      can't break unrelated routes.
 */

type PdfParseResult = { text: string; numpages: number };

let pdfParseFn: ((buf: Buffer) => Promise<PdfParseResult>) | null = null;

async function loadPdfParse(): Promise<(buf: Buffer) => Promise<PdfParseResult>> {
  if (pdfParseFn) return pdfParseFn;
  // Bypass the test-running index.js by importing the inner module.
  const mod = await import(
    /* webpackIgnore: true */ "pdf-parse/lib/pdf-parse.js" as string
  );
  const fn = (mod as { default?: unknown }).default ?? mod;
  pdfParseFn = fn as (buf: Buffer) => Promise<PdfParseResult>;
  return pdfParseFn;
}

export async function extractPdfText(buf: Buffer, maxChars = 40_000): Promise<string> {
  try {
    const parse = await loadPdfParse();
    const { text } = await parse(buf);
    return text.slice(0, maxChars);
  } catch {
    // Image-scanned PDFs and load failures both end up here. Caller should
    // fall back to vision when text is empty.
    return "";
  }
}
