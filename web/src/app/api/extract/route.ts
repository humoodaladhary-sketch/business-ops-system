/**
 * POST /api/extract
 *
 * Accepts multipart form data:
 *   - project_name, developer, zone (optional strings)
 *   - files[] — Excel, PDFs, images
 *
 * Parses Excel + PDFs server-side, sends everything to Claude with the
 * extraction prompt, returns the normalized units.
 *
 * Note: this MVP route returns the AI output directly without persisting
 * to Supabase, so you can see the extraction working before wiring up the
 * DB. Next milestone inserts into `projects`, `files`, `units`, `unit_fields`.
 */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { parseExcelBuffer } from "@/lib/parsers/excel";
import { extractPdfText } from "@/lib/parsers/pdf";
import { buildExtractionPrompt } from "@/lib/prompts/extraction";

export const runtime = "nodejs"; // pdf-parse + xlsx need node runtime
export const maxDuration = 120;  // extraction can take 60-90s

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const project_name = String(form.get("project_name") ?? "");
    const developer = String(form.get("developer") ?? "");
    const zone = String(form.get("zone") ?? "");
    const files = form.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Parse every file by type
    let excelRows: unknown[] = [];
    const brochureTexts: string[] = [];
    const imageFilenames: string[] = [];

    for (const file of files) {
      const name = file.name.toLowerCase();
      const buf = Buffer.from(await file.arrayBuffer());

      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
        const rows = parseExcelBuffer(buf);
        excelRows = excelRows.concat(rows);
      } else if (name.endsWith(".pdf")) {
        const text = await extractPdfText(buf);
        if (text) brochureTexts.push(`--- ${file.name} ---\n${text}`);
      } else if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
        imageFilenames.push(file.name);
      }
    }

    // Vision analysis of images is a separate call in M1 — for now just
    // pass filenames so the extraction prompt knows they exist.
    const renderCaptions = imageFilenames.map((n) => `Image file: ${n}`);

    const prompt = buildExtractionPrompt({
      excelRows,
      brochureText: brochureTexts.join("\n\n"),
      renderCaptions,
      projectHint: { name: project_name, developer, zone },
    });

    const { data, usage } = await runJson({
      userPrompt: prompt,
      maxTokens: 16_000,
    });

    return NextResponse.json({
      ok: true,
      inputSummary: {
        files: files.length,
        excel_rows: excelRows.length,
        pdf_text_chars: brochureTexts.reduce((a, b) => a + b.length, 0),
        images: imageFilenames.length,
      },
      usage,
      ...(data as object),
    });
  } catch (err) {
    console.error("extract error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
