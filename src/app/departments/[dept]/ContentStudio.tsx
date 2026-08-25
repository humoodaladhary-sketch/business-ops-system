"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Clipboard, Info, Loader2, Save, ShieldAlert, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ITC_PROJECTS } from "../../_data/itc-zones";
import type { InventoryUnit } from "../../_data/runtimeConfig";

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "WhatsApp"] as const;
const CONTENT_TYPES = ["Reel script", "Carousel", "Caption + hashtags", "Post", "Hook pack"] as const;

// Where a unit listing can be published. Mirrors the platform ids the listing
// domain understands; kept as plain data here so the client bundle does not
// have to pull in the domain module (and decimal.js with it).
const LISTING_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "property_finder", label: "Property Finder" },
  { id: "dubizzle", label: "Dubizzle" },
  { id: "opensouq", label: "OpenSouq" },
  { id: "website", label: "Website" },
] as const;

type ListingPlatformId = (typeof LISTING_PLATFORMS)[number]["id"];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ar", label: "العربية" },
  { id: "both", label: "Both" },
] as const;

type LanguageId = (typeof LANGUAGES)[number]["id"];

/** The server's verdict on what this unit's copy may claim. */
interface ListingGate {
  eligibility: "all_nationalities" | "gcc_omani_only" | "unknown";
  foreignOwnership: boolean;
  matchedProject: string | null;
  matchConfidence: "exact" | "alias" | "fuzzy" | "none";
  warnings: string[];
  unknowns: string[];
  platform: string;
  publishable: boolean;
  blockedReason: string | null;
}

const omr = (n: number) => `${new Intl.NumberFormat("en-US").format(n)} OMR`;

function unitLabel(u: InventoryUnit): string {
  const beds = u.bedrooms != null && u.bedrooms > 0 ? ` · ${u.bedrooms}BR` : "";
  const status = u.status === "AVAILABLE" ? "" : ` · ${u.status.toLowerCase()}`;
  return `${u.project} — ${u.unitType}${beds} · ${omr(u.priceOMR)}${status}`;
}

// A few ITC (all-nationalities) project names as quick topic chips, plus evergreen angles.
const TOPIC_CHIPS = [
  ...ITC_PROJECTS.filter((p) => p.category === "ITC")
    .slice(0, 4)
    .map((p) => p.name),
  "Golden Residency",
  "Why Oman ITC",
  "Market update",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

type Mode = "topic" | "unit";

export function ContentStudio({}: {}) {
  const [mode, setMode] = useState<Mode>("topic");
  const [platform, setPlatform] = useState<string>("Instagram");
  const [ctype, setCtype] = useState<string>("Reel script");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // --- Unit mode ------------------------------------------------------------
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [unitId, setUnitId] = useState<string>("");
  const [listingPlatform, setListingPlatform] = useState<ListingPlatformId>("instagram");
  const [language, setLanguage] = useState<LanguageId>("en");
  const [angle, setAngle] = useState("");
  const [gate, setGate] = useState<ListingGate | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  const selectedUnit = units.find((u) => u.id === unitId) ?? null;

  useEffect(() => {
    if (mode !== "unit" || units.length) return;
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((j) => {
        const list: InventoryUnit[] = j.units ?? [];
        setUnits(list);
        // Default to the first unit that can actually be advertised.
        const first = list.find((u) => u.status !== "SOLD") ?? list[0];
        if (first) setUnitId(first.id);
      })
      .catch(() => setErr("Couldn't load inventory."));
  }, [mode, units.length]);

  // Ask the server what this unit's copy may claim, before spending a call on it.
  const loadGate = useCallback(async (id: string) => {
    if (!id) return setGate(null);
    setGateBusy(true);
    try {
      const r = await fetch(`/api/listings/generate?unitId=${encodeURIComponent(id)}`);
      const j = await r.json();
      setGate(j.gate ?? null);
    } catch {
      setGate(null);
    } finally {
      setGateBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadGate(unitId);
  }, [unitId, loadGate]);

  async function generateListing() {
    if (!unitId || busy || saving) return;
    setErr(null);
    setResult(null);
    setSavedNote(null);
    setCopied(false);
    setBusy(true);
    try {
      const r = await fetch("/api/listings/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unitId,
          platform: listingPlatform,
          language,
          angle: angle.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (j.gate) setGate(j.gate);
      if (j.setup) {
        setErr("The copilot needs its Anthropic key first — see the Copilot section below.");
      } else if (j.error) {
        setErr(j.detail ? `${j.error}: ${j.detail}` : j.error);
      } else if (j.ok) {
        setResult(j.reply);
        // Saving to the library replays the exact prompt the server built.
        setLastPrompt(j.prompt);
      }
    } catch {
      setErr("Network error — please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function callCopilot(messages: Msg[]): Promise<string | null> {
    const r = await fetch("/api/copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ department: "marketing", messages }),
    });
    const j = await r.json();
    if (j.setup) {
      setErr("The copilot needs its Anthropic key first — see the Copilot section below.");
      return null;
    }
    if (j.error) {
      setErr(j.detail ? `${j.error}: ${j.detail}` : j.error);
      return null;
    }
    return j.reply as string;
  }

  async function generate() {
    const t = topic.trim();
    if (!t || busy || saving) return;
    setErr(null);
    setResult(null);
    setSavedNote(null);
    setCopied(false);
    setBusy(true);
    const prompt = `Create a ${ctype} for ${platform} about: ${t}. Use your live tools for any figures. Return the complete pack (hook, body/script, caption, hashtags, CTA) ready to publish. After the pack, do not ask questions.`;
    try {
      const reply = await callCopilot([{ role: "user", content: prompt }]);
      if (reply) {
        setResult(reply);
        setLastPrompt(prompt);
      }
    } catch {
      setErr("Network error — please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  async function saveToLibrary() {
    if (!result || !lastPrompt || saving || busy) return;
    setErr(null);
    setSaving(true);
    const label =
      mode === "unit"
        ? {
            platform: LISTING_PLATFORMS.find((p) => p.id === listingPlatform)?.label ?? listingPlatform,
            title: `Listing: ${selectedUnit ? unitLabel(selectedUnit) : unitId}`,
          }
        : { platform, title: `${ctype}: ${topic.trim()}` };
    const followUp = `Save this exact draft to the content library with save_content_draft. Platform: ${label.platform}. Title: ${label.title}.`;
    try {
      const reply = await callCopilot([
        { role: "user", content: lastPrompt },
        { role: "assistant", content: result },
        { role: "user", content: followUp },
      ]);
      if (reply) setSavedNote(reply);
    } catch {
      setErr("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-ink-100/50 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="font-heading text-lg text-white">Content Studio</h2>
        <p className="text-sm text-white/50">
          Generate on-brand content grounded in live data — then save it to the library.
        </p>
      </div>

      {/* Mode */}
      <div className="mb-4 inline-flex rounded-lg border border-hairline p-0.5">
        {(
          [
            { id: "topic", label: "Topic" },
            { id: "unit", label: "From a unit" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setErr(null);
            }}
            className={
              mode === m.id
                ? "rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-ink"
                : "rounded-md px-3 py-1.5 text-xs text-white/60 hover:text-gold"
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "unit" ? (
        <UnitPanel
          units={units}
          unitId={unitId}
          setUnitId={setUnitId}
          listingPlatform={listingPlatform}
          setListingPlatform={setListingPlatform}
          language={language}
          setLanguage={setLanguage}
          angle={angle}
          setAngle={setAngle}
          gate={gate}
          gateBusy={gateBusy}
          busy={busy || saving}
          onGenerate={generateListing}
        />
      ) : (
        <>
      {/* Platform pills */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={
              platform === p
                ? "rounded-full border border-gold bg-gold px-3 py-1.5 text-xs font-semibold text-ink"
                : "rounded-full border border-hairline px-3 py-1.5 text-xs text-white/60 hover:border-gold/40 hover:text-gold"
            }
          >
            {p}
          </button>
        ))}
      </div>

      {/* Type + topic */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={ctype}
          onChange={(e) => setCtype(e.target.value)}
          className="rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white focus:border-gold/50 focus:outline-none sm:w-52"
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") generate();
          }}
          placeholder="Topic — a project, an angle, a question…"
          className="flex-1 rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
        />
      </div>

      {/* Topic quick chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TOPIC_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setTopic(c)}
            className="rounded-full border border-hairline px-2.5 py-1 text-[11px] text-white/55 hover:border-gold/40 hover:text-gold"
          >
            {c}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={busy || saving || !topic.trim()}
        className="mt-3 inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {busy ? "Generating…" : "Generate"}
      </button>
        </>
      )}

      {err && <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{err}</p>}

      {/* Result */}
      {result && (
        <div className="mt-4 rounded-2xl border border-hairline bg-ink-900/50 p-4 text-sm text-white/85">
          <AgentMarkdown>{result}</AgentMarkdown>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs text-white/70 hover:border-gold/40 hover:text-gold"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-gold" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={saveToLibrary}
              disabled={saving || busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save to library"}
            </button>
          </div>
          {savedNote && (
            <div className="mt-3 rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-white/80">
              <AgentMarkdown>{savedNote}</AgentMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The unit-listing controls: which unit, where it goes, in what language — plus
// the server's verdict on what the copy is allowed to claim about it.
function UnitPanel(props: {
  units: InventoryUnit[];
  unitId: string;
  setUnitId: (v: string) => void;
  listingPlatform: ListingPlatformId;
  setListingPlatform: (v: ListingPlatformId) => void;
  language: LanguageId;
  setLanguage: (v: LanguageId) => void;
  angle: string;
  setAngle: (v: string) => void;
  gate: ListingGate | null;
  gateBusy: boolean;
  busy: boolean;
  onGenerate: () => void;
}) {
  const { units, unitId, gate, gateBusy, busy } = props;
  const field =
    "rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white focus:border-gold/50 focus:outline-none";
  const blocked = gate?.publishable === false;

  if (!units.length) {
    return (
      <p className="rounded-md border border-hairline bg-ink-900/40 p-3 text-sm text-white/50">
        No units in inventory yet — add stock on the Inventory page, then come back to write its listing.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <select
        value={unitId}
        onChange={(e) => props.setUnitId(e.target.value)}
        className={`${field} w-full`}
        aria-label="Unit"
      >
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {unitLabel(u)}
          </option>
        ))}
      </select>

      {/* Platform pills */}
      <div className="flex flex-wrap gap-1.5">
        {LISTING_PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => props.setListingPlatform(p.id)}
            className={
              props.listingPlatform === p.id
                ? "rounded-full border border-gold bg-gold px-3 py-1.5 text-xs font-semibold text-ink"
                : "rounded-full border border-hairline px-3 py-1.5 text-xs text-white/60 hover:border-gold/40 hover:text-gold"
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={props.language}
          onChange={(e) => props.setLanguage(e.target.value as LanguageId)}
          className={`${field} sm:w-40`}
          aria-label="Language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <input
          value={props.angle}
          onChange={(e) => props.setAngle(e.target.value)}
          placeholder="Angle (optional) — e.g. lead with the payment plan"
          maxLength={300}
          className={`${field} flex-1 placeholder:text-white/30`}
          aria-label="Angle"
        />
      </div>

      {gateBusy && <p className="text-xs text-white/40">Checking what this unit can claim…</p>}
      {gate && !gateBusy && <GateBanner gate={gate} />}

      <button
        type="button"
        onClick={props.onGenerate}
        disabled={busy || !unitId || blocked}
        className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {busy ? "Writing the listing…" : "Write the listing"}
      </button>
    </div>
  );
}

// Says plainly which angles this unit unlocks and which it forbids. The
// restriction is a legal one, not a style note, so it is stated before the copy
// is written rather than discovered afterwards.
function GateBanner({ gate }: { gate: ListingGate }) {
  if (!gate.publishable) {
    return (
      <div className="flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">This unit cannot be advertised.</p>
          <p className="mt-0.5 text-red-200/80">{gate.blockedReason}</p>
        </div>
      </div>
    );
  }

  const foreign = gate.foreignOwnership;
  const tone = foreign
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/30 bg-amber-500/10 text-amber-200";

  return (
    <div className={`space-y-2 rounded-md border p-3 text-xs ${tone}`}>
      <div className="flex gap-2">
        {foreign ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <p className="font-semibold">
            {foreign
              ? "ITC freehold — open to all nationalities"
              : gate.eligibility === "gcc_omani_only"
                ? "Omani & GCC buyers only"
                : "Ownership rule unconfirmed"}
          </p>
          <p className="mt-0.5 opacity-80">
            {foreign
              ? "Foreign ownership and the Golden/Investor Residency angle are available for this unit."
              : "The listing will not mention foreign ownership, freehold for expats, or any residency pathway."}
          </p>
          {gate.matchedProject && (
            <p className="mt-1 opacity-60">
              Matched to {gate.matchedProject} ({gate.matchConfidence}).
            </p>
          )}
        </div>
      </div>
      {gate.warnings.length > 0 && (
        <ul className="ml-6 list-disc space-y-0.5 opacity-80">
          {gate.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Renders the agent's markdown reply — tables scroll on mobile, gold-accented.
// Styled via arbitrary variants (no custom components → no node-prop pitfalls).
function AgentMarkdown({ children }: { children: string }) {
  return (
    <div
      className={
        "space-y-2 leading-relaxed " +
        "[&_p]:my-1.5 " +
        "[&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:font-heading [&_h1]:text-base [&_h1]:text-white " +
        "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:font-heading [&_h2]:text-base [&_h2]:text-white " +
        "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-semibold [&_h3]:text-white " +
        "[&_ul]:my-1.5 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1 " +
        "[&_ol]:my-1.5 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 " +
        "[&_li]:marker:text-gold/60 " +
        "[&_strong]:font-semibold [&_strong]:text-white " +
        "[&_a]:text-gold [&_a]:underline " +
        "[&_code]:rounded [&_code]:bg-ink [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-gold " +
        "[&_hr]:my-3 [&_hr]:border-hairline " +
        "[&_blockquote]:border-l-2 [&_blockquote]:border-gold/40 [&_blockquote]:pl-3 [&_blockquote]:text-white/70 " +
        "[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-xs " +
        "[&_th]:whitespace-nowrap [&_th]:border [&_th]:border-hairline [&_th]:bg-ink-900/60 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-white/60 " +
        "[&_td]:border [&_td]:border-white/5 [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-white/85"
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
