// Generates a publication-ready listing for one real inventory unit.
//
// The unit is looked up and the brief is built HERE, on the server, from the
// unit id alone. The client sends an id, a platform and a language — never the
// facts and never the constraints. That is deliberate: the ownership gate that
// keeps foreign-investor claims off Omani/GCC-only stock is only a safeguard if
// the caller cannot edit it on the way past.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/infrastructure/auth/session";
import { getUnits } from "@/app/_data/runtimeConfig";
import { ITC_PROJECTS } from "@/app/_data/itc-zones";
import { buildListingBrief, listingBriefToPrompt } from "@/domain/realestate/listing";
import { runCopilot } from "@/lib/copilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  unitId: z.string().min(1),
  platform: z.enum([
    "instagram",
    "whatsapp",
    "linkedin",
    "property_finder",
    "dubizzle",
    "opensouq",
    "website",
  ]),
  language: z.enum(["en", "ar", "both"]),
  angle: z.string().max(300).optional(),
});

/** The operator-facing summary of what the brief will and will not permit. */
function gateOf(brief: ReturnType<typeof buildListingBrief>) {
  return {
    eligibility: brief.eligibility,
    foreignOwnership: brief.foreignOwnership,
    matchedProject: brief.resolved.project?.name ?? null,
    matchConfidence: brief.resolved.confidence,
    warnings: brief.warnings,
    unknowns: brief.unknowns,
    platform: brief.platform.label,
    publishable: brief.publishable,
    blockedReason: brief.blockedReason,
  };
}

/**
 * Previews the gate for a unit without generating anything, so the UI can tell
 * the operator up front which angles are available — and, on GCC-only stock,
 * why the foreign-investor angle is not — before a model call is spent.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const unitId = req.nextUrl.searchParams.get("unitId");
  if (!unitId) return NextResponse.json({ error: "unitId is required." }, { status: 400 });

  const unit = getUnits().find((u) => u.id === unitId);
  if (!unit) return NextResponse.json({ error: "That unit is no longer in inventory." }, { status: 404 });

  const brief = buildListingBrief({
    unit,
    platform: "website",
    language: "en",
    catalogue: ITC_PROJECTS,
  });

  return NextResponse.json({ ok: true, gate: gateOf(brief) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { unitId, platform, language, angle } = parsed.data;

  const unit = getUnits().find((u) => u.id === unitId);
  if (!unit) {
    return NextResponse.json({ error: "That unit is no longer in inventory." }, { status: 404 });
  }

  const brief = buildListingBrief({
    unit,
    platform,
    language,
    catalogue: ITC_PROJECTS,
    angle,
  });

  // Returned on every path so the UI can explain what was and was not
  // permitted, whether or not copy was produced.
  const gate = gateOf(brief);

  // Sold stock is refused before the model is called — there is no version of
  // this listing that is honest, so spending a request on it is pure waste.
  if (!brief.publishable) {
    return NextResponse.json({ error: brief.blockedReason, gate }, { status: 422 });
  }

  const prompt = listingBriefToPrompt(brief);

  try {
    const out = await runCopilot("marketing", [{ role: "user", content: prompt }]);

    if ("ok" in out) {
      console.log(
        `[listing] unit=${unit.id} platform=${platform} lang=${language} ` +
          `eligibility=${brief.eligibility} foreign=${brief.foreignOwnership} -> ok(${out.reply.length}c)`,
      );
      return NextResponse.json({ ok: true, reply: out.reply, prompt, gate });
    }

    if ("setup" in out) {
      return NextResponse.json({ setup: true, reason: out.reason, gate });
    }

    console.log(`[listing] unit=${unit.id} -> error:${out.error}${out.status ? "/" + out.status : ""}`);
    return NextResponse.json({ error: out.error, detail: out.detail, gate }, { status: 502 });
  } catch (e) {
    const detail = (e as Error).message.slice(0, 200);
    console.log(`[listing] unit=${unit.id} -> threw:${detail.slice(0, 120)}`);
    return NextResponse.json({ error: "listing_failed", detail, gate }, { status: 500 });
  }
}
