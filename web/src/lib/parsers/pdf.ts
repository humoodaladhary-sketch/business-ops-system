/** PDF text extractor. Uses pdf-parse on the server. */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

export async function extractPdfText(buf: Buffer, maxChars = 40_000): Promise<string> {
  try {
    const { text } = await pdfParse(buf);
    return text.slice(0, maxChars);
  } catch (err) {
    // Image-scanned PDFs fail here. Upstream code should fall back to vision.
    return "";
  }
}
