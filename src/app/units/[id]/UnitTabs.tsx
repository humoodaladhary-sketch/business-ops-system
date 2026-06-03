"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { SourceBadge } from "@/components/ui/SourceBadge";
import type {
  BuyerProfile,
  Listing,
  Platform,
  RoiScores,
  Unit,
  UnitField,
} from "@/types";

type Tab = "overview" | "listings" | "buyer" | "roi" | "audit";

const PLATFORM_LIMITS: Record<Platform, { title: number; body: number }> = {
  property_finder: { title: 100, body: 5000 },
  olx_oman: { title: 70, body: 3000 },
  instagram: { title: 150, body: 2200 },
  whatsapp: { title: 120, body: 1200 },
  linkedin: { title: 150, body: 3000 },
  website: { title: 120, body: 6000 },
};

export function UnitTabs({
  unit,
  roi: roiInitial,
  buyer: buyerInitial,
  fields,
  listings: listingsInitial,
}: {
  unit: Unit;
  roi: RoiScores | null;
  buyer: BuyerProfile | null;
  fields: UnitField[];
  listings: Listing[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [roi, setRoi] = useState(roiInitial);
  const [buyer, setBuyer] = useState(buyerInitial);
  const [listings, setListings] = useState(listingsInitial);
  const [pitch, setPitch] = useState<{ en: string; ar: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  async function run(path: string, init?: RequestInit) {
    const resp = await fetch(path, { method: "POST", ...init });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body?.error ?? `Request failed: ${resp.status}`);
    }
    return resp.json();
  }

  function handle(name: string, fn: () => Promise<void>) {
    startTransition(async () => {
      setStatus(`${name}…`);
      try {
        await fn();
        setStatus(`${name} ✓`);
      } catch (e) {
        setStatus(`${name} failed: ${(e as Error).message}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <section className="card p-4 flex flex-wrap gap-2 items-center">
        <button
          className="btn-gold text-xs"
          disabled={busy}
          onClick={() =>
            handle("Generate listings", async () => {
              const out = await run(`/api/units/${unit.id}/generate`, {
                body: JSON.stringify({}),
                headers: { "Content-Type": "application/json" },
              });
              setListings(out.listings);
              setTab("listings");
            })
          }
        >
          ⚡ Generate all listings
        </button>
        <button
          className="btn-primary text-xs"
          disabled={busy}
          onClick={() =>
            handle("ROI", async () => {
              const out = await run(`/api/units/${unit.id}/roi`);
              setRoi({ unit_id: unit.id, ...out.roi });
              setTab("roi");
            })
          }
        >
          📈 Compute ROI
        </button>
        <button
          className="btn-primary text-xs"
          disabled={busy}
          onClick={() =>
            handle("Buyer profile", async () => {
              const out = await run(`/api/units/${unit.id}/buyer`);
              setBuyer({ unit_id: unit.id, ...out.buyer });
              setTab("buyer");
            })
          }
        >
          👤 Predict buyer
        </button>
        <button
          className="btn-primary text-xs"
          disabled={busy}
          onClick={() =>
            handle("WhatsApp pitch", async () => {
              const out = await run(`/api/units/${unit.id}/pitch`);
              setPitch(out.pitch);
            })
          }
        >
          💬 WhatsApp pitch
        </button>
        {status && (
          <span className="ml-auto text-xs text-[var(--color-brand-gray-500)]">{status}</span>
        )}
      </section>

      {/* Tabs */}
      <nav className="flex border-b border-[var(--color-brand-gray-200)] text-sm">
        {(["overview", "listings", "buyer", "roi", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 uppercase tracking-wider text-xs font-medium transition ${
              tab === t
                ? "text-[var(--color-brand-black)] border-b-2 border-[var(--color-brand-gold)]"
                : "text-[var(--color-brand-gray-500)] hover:text-[var(--color-brand-black)]"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewTab unit={unit} roi={roi} buyer={buyer} pitch={pitch} />
      )}
      {tab === "listings" && <ListingsTab listings={listings} />}
      {tab === "buyer" && <BuyerTab buyer={buyer} />}
      {tab === "roi" && <RoiTab roi={roi} />}
      {tab === "audit" && <AuditTab fields={fields} />}
    </div>
  );
}

// ----- Overview ---------------------------------------------------------

function OverviewTab({
  unit, roi, buyer, pitch,
}: {
  unit: Unit;
  roi: RoiScores | null;
  buyer: BuyerProfile | null;
  pitch: { en: string; ar: string } | null;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="card p-5">
        <h2 className="font-display text-lg mb-3">Specifications</h2>
        <dl className="text-sm space-y-1">
          <Row label="Type" value={unit.unit_type.replace("_", " ")} />
          <Row label="Bedrooms" value={unit.bedrooms?.toString() ?? "—"} />
          <Row label="Bathrooms" value={unit.bathrooms?.toString() ?? "—"} />
          <Row label="Area" value={unit.area_sqm ? `${unit.area_sqm} sqm` : "—"} />
          <Row label="View" value={unit.view ?? "—"} />
          <Row label="Parking" value={unit.parking?.toString() ?? "—"} />
          <Row label="Price" value={unit.price_omr ? `OMR ${unit.price_omr.toLocaleString()}` : "—"} />
          <Row label="Ownership" value={unit.ownership_type.replace("_", " ")} />
          <Row label="Payment plan" value={unit.payment_plan ?? "—"} />
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg mb-3">Snapshot</h2>
        {roi ? (
          <ul className="text-sm space-y-1">
            <li>Rental yield: <strong>{roi.rental_yield_low_pct}% – {roi.rental_yield_high_pct}%</strong></li>
            <li>ROI score: <strong>{roi.roi_score}/10</strong></li>
            <li>Liquidity: <strong>{roi.liquidity_score}/10</strong></li>
            <li>Appreciation: <strong>{roi.appreciation_score}/10</strong></li>
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-brand-gray-500)]">
            ROI not computed yet. Click <em>Compute ROI</em> above.
          </p>
        )}
        {buyer && (
          <>
            <h3 className="font-display text-sm mt-4">Ideal buyer</h3>
            <p className="text-sm mt-1">{buyer.primary_buyer.replace("_", " ")}</p>
            <p className="text-xs text-[var(--color-brand-gray-500)] mt-1">{buyer.sales_angle}</p>
          </>
        )}
      </section>

      {pitch && (
        <section className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-lg">WhatsApp pitch</h2>
            <CopyButton text={`${pitch.en}\n\n— — —\n\n${pitch.ar}`} />
          </div>
          <pre className="whitespace-pre-wrap text-sm font-mono bg-[var(--color-brand-gray-50)] p-4 rounded-sm">
            {pitch.en}
            {"\n\n— — —\n\n"}
            {pitch.ar}
          </pre>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-1 border-b border-[var(--color-brand-gray-200)] last:border-0">
      <dt className="text-[var(--color-brand-gray-500)] text-xs uppercase tracking-wider">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// ----- Listings tab -----------------------------------------------------

function ListingsTab({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
        No listings yet. Click <em>Generate all listings</em> above.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {listings.map((l) => (
        <ListingPanel key={l.id} listing={l} />
      ))}
    </div>
  );
}

function ListingPanel({ listing }: { listing: Listing }) {
  const [title, setTitle] = useState(listing.title);
  const [body, setBody] = useState(listing.body);
  const [saved, setSaved] = useState(false);

  const limits = PLATFORM_LIMITS[listing.platform];
  const titleOver = limits && title.length > limits.title;
  const bodyOver = limits && body.length > limits.body;

  async function save() {
    const resp = await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (resp.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="badge badge-gold">{listing.platform.replace("_", " ")}</span>
          <span className="badge badge-extracted uppercase">{listing.language}</span>
        </div>
        {listing.warnings?.length > 0 && (
          <span className="text-xs text-amber-700">⚠ {listing.warnings.join("; ")}</span>
        )}
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)] flex justify-between">
          <span>Title</span>
          <span className={titleOver ? "text-red-700" : ""}>
            {title.length}
            {limits ? ` / ${limits.title}` : ""}
          </span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border border-[var(--color-brand-gray-200)] rounded-sm px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)] flex justify-between">
          <span>Body</span>
          <span className={bodyOver ? "text-red-700" : ""}>
            {body.length}
            {limits ? ` / ${limits.body}` : ""}
          </span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="mt-1 w-full border border-[var(--color-brand-gray-200)] rounded-sm px-3 py-2 text-sm font-mono"
        />
      </div>

      {listing.cta && (
        <div className="text-sm">
          <span className="badge badge-gold">CTA</span> {listing.cta}
        </div>
      )}
      {listing.hashtags?.length > 0 && (
        <div className="text-xs text-[var(--color-brand-gray-500)]">
          {listing.hashtags.map((h) => "#" + h.replace(/^#/, "")).join(" ")}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <CopyButton text={title} label="Copy title" />
        <CopyButton text={body} label="Copy body" />
        {listing.hashtags?.length > 0 && (
          <CopyButton text={listing.hashtags.map((h) => "#" + h.replace(/^#/, "")).join(" ")} label="Copy hashtags" />
        )}
        <button className="btn-primary text-xs ml-auto" onClick={save}>
          {saved ? "✓ Saved" : "💾 Save edits"}
        </button>
      </div>
    </section>
  );
}

// ----- Buyer tab --------------------------------------------------------

function BuyerTab({ buyer }: { buyer: BuyerProfile | null }) {
  if (!buyer) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
        Buyer profile not computed yet. Click <em>Predict buyer</em> above.
      </div>
    );
  }
  return (
    <section className="card p-6 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">Primary buyer</div>
        <div className="font-display text-xl">{buyer.primary_buyer.replace(/_/g, " ")}</div>
        {buyer.secondary_buyer && (
          <div className="text-xs text-[var(--color-brand-gray-500)] mt-1">
            secondary: {buyer.secondary_buyer.replace(/_/g, " ")}
          </div>
        )}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">Best nationalities</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {buyer.best_nationalities?.map((n) => (
            <span key={n} className="badge badge-extracted">{n}</span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">Motivation</div>
        <p className="text-sm mt-1">{buyer.motivation}</p>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">Expected rental audience</div>
        <p className="text-sm mt-1">{buyer.expected_rental_audience}</p>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">Sales angle</div>
        <p className="text-sm mt-1 italic">&ldquo;{buyer.sales_angle}&rdquo;</p>
      </div>
      {buyer.objections?.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)] mb-2">Objections</div>
          <div className="space-y-3">
            {buyer.objections.map((o, i) => (
              <div key={i} className="border-l-2 border-[var(--color-brand-gold)] pl-3">
                <div className="text-sm font-medium">&ldquo;{o.objection}&rdquo;</div>
                <div className="text-sm text-[var(--color-brand-gray-700)] mt-1">{o.response}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ----- ROI tab ----------------------------------------------------------

function RoiTab({ roi }: { roi: RoiScores | null }) {
  if (!roi) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
        ROI not computed yet. Click <em>Compute ROI</em> above.
      </div>
    );
  }
  const scores = [
    { label: "Rental yield", value: `${roi.rental_yield_low_pct}% – ${roi.rental_yield_high_pct}%`, detail: roi.rationale?.rental_yield },
    { label: "Demand strength", value: `${roi.demand_strength}/10`, detail: roi.rationale?.demand_strength },
    { label: "Liquidity", value: `${roi.liquidity_score}/10`, detail: roi.rationale?.liquidity_score },
    { label: "ROI composite", value: `${roi.roi_score}/10`, detail: roi.rationale?.roi_score },
    { label: "Appreciation", value: `${roi.appreciation_score}/10`, detail: roi.rationale?.appreciation_score },
  ];
  return (
    <section className="space-y-3">
      {scores.map((s) => (
        <div key={s.label} className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">{s.label}</div>
            <div className="font-display text-xl">{s.value}</div>
          </div>
          {s.detail && <p className="text-sm mt-2 text-[var(--color-brand-gray-700)]">{s.detail}</p>}
        </div>
      ))}
    </section>
  );
}

// ----- Audit tab --------------------------------------------------------

function AuditTab({ fields }: { fields: UnitField[] }) {
  if (fields.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
        No source-tagged fields recorded.
      </div>
    );
  }
  return (
    <section className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-brand-gray-50)] text-left text-xs uppercase tracking-wider">
            <th className="p-3">Field</th>
            <th className="p-3">Value</th>
            <th className="p-3">Source</th>
            <th className="p-3">Conf.</th>
            <th className="p-3">Reasoning</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id} className="border-t border-[var(--color-brand-gray-200)]">
              <td className="p-3 font-mono text-xs">{f.field_name}</td>
              <td className="p-3">{f.value ?? "—"}</td>
              <td className="p-3"><SourceBadge source={f.source} /></td>
              <td className="p-3">{f.confidence != null ? `${(f.confidence * 100).toFixed(0)}%` : "—"}</td>
              <td className="p-3 text-xs text-[var(--color-brand-gray-500)]">{f.reasoning ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
