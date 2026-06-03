/**
 * POST /api/extract
 *
 * Parses the uploaded project pack, runs Claude with the extraction prompt,
 * and persists: project + units + unit_fields.
 *
 * Returns { project_id, unit_ids[] } so the UI can redirect to the
 * inventory page.
 */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { parseExcelBuffer } from "@/lib/parsers/excel";
import { extractPdfText } from "@/lib/parsers/pdf";
import { PROMPT_VERSION } from "@/lib/prompts/_system";
import { buildExtractionPrompt } from "@/lib/prompts/extraction";
import {
  getOrCreateDefaultOrgId,
  insertProject,
  replaceUnitFields,
  upsertUnit,
} from "@/lib/supabase/db";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ExtractionResponse {
  project: {
    name: string;
    developer: string | null;
    zone: string | null;
    ownership_type: "freehold_itc" | "usufruct" | "leasehold" | "unknown";
    handover_date: string | null;
  };
  units: Array<{
    reference_id: string;
    unit_number: string | null;
    unit_type: string;
    bedrooms: number | null;
    bathrooms: number | null;
    area_sqm: number | null;
    price_omr: number | null;
    payment_plan: string | null;
    floor: number | null;
    building: string | null;
    view: string | null;
    parking: number | null;
    amenities: string[];
    fields: Array<{
      name: string;
      value: string;
      source: "extracted" | "inferred" | "assumed" | "missing";
      source_file_id: string | null;
      confidence: number;
      reasoning: string;
    }>;
  }>;
}

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

    // Parse each file by type.
    let excelRows: unknown[] = [];
    const brochureTexts: string[] = [];
    const imageFilenames: string[] = [];

    for (const file of files) {
      const name = file.name.toLowerCase();
      const buf = Buffer.from(await file.arrayBuffer());
      if (/\.(xlsx|xls|csv)$/i.test(name)) {
        excelRows = excelRows.concat(parseExcelBuffer(buf));
      } else if (name.endsWith(".pdf")) {
        const text = await extractPdfText(buf);
        if (text) brochureTexts.push(`--- ${file.name} ---\n${text}`);
      } else if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
        imageFilenames.push(file.name);
      }
    }

    const prompt = buildExtractionPrompt({
      excelRows,
      brochureText: brochureTexts.join("\n\n"),
      renderCaptions: imageFilenames.map((n) => `Image file: ${n}`),
      projectHint: { name: project_name, developer, zone },
    });

    const { data, usage } = await runJson<ExtractionResponse>({ userPrompt: prompt, maxTokens: 16_000 });

    const organization_id = await getOrCreateDefaultOrgId();
    const project = await insertProject({
      organization_id,
      name: data.project.name || project_name || "Untitled project",
      developer: data.project.developer ?? (developer || null),
      zone: data.project.zone ?? (zone || null),
      ownership_type: data.project.ownership_type ?? "unknown",
      handover_date: data.project.handover_date,
    });

    const unit_ids: string[] = [];
    for (const u of data.units ?? []) {
      if (!u.reference_id || !u.unit_type) continue;
      const saved = await upsertUnit({
        organization_id,
        project_id: project.id,
        reference_id: u.reference_id,
        unit_number: u.unit_number,
        unit_type: u.unit_type as never, // validated by DB enum
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        area_sqm: u.area_sqm,
        price_omr: u.price_omr,
        payment_plan: u.payment_plan,
        floor: u.floor,
        building: u.building,
        view: u.view,
        parking: u.parking,
        amenities: u.amenities ?? [],
        ownership_type: data.project.ownership_type ?? "unknown",
      });
      unit_ids.push(saved.id);
      if (u.fields?.length) {
        await replaceUnitFields(
          saved.id,
          u.fields.map((f) => ({
            field_name: f.name,
            value: f.value ?? null,
            source: f.source,
            source_file_id: f.source_file_id,
            confidence: typeof f.confidence === "number" ? f.confidence : null,
            reasoning: f.reasoning ?? null,
          })),
        );
      }
    }

    return NextResponse.json({
      ok: true,
      project_id: project.id,
      unit_ids,
      unit_count: unit_ids.length,
      prompt_version: PROMPT_VERSION,
      usage,
    });
  } catch (err) {
    console.error("extract error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
