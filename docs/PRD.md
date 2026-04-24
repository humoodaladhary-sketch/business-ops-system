# Alwalaa AI Listing Agent — Product Requirements Document

**Version:** 1.0 (MVP)
**Prepared for:** Humood Aladhari, CEO, Alwalaa Real Estate
**Status:** Active development
**Target market:** Oman (Muscat + ITC/freehold zones)

---

## 1. Vision

A private, elite, one-click real-estate intelligence system purpose-built for
Alwalaa's Oman inventory. Upload a project pack (Excel inventory, brochures,
renders, payment plans, floor plans) and the system:

1. Reads and extracts every unit's data automatically.
2. Generates publication-ready listings for Property Finder, OLX Oman,
   Instagram, WhatsApp, LinkedIn, and the Alwalaa website.
3. Predicts the ideal buyer profile and writes the sales angle.
4. Estimates ROI, liquidity, and appreciation scores per unit.
5. Produces comparison reports and ready-to-send WhatsApp pitches.
6. Exports everything to PDF and Excel.

Zero manual copywriting. Zero manual data entry. Zero market-research work.
The broker's job becomes qualifying leads and closing — not producing content.

---

## 2. Why this is different from a generic listing tool

Generic real-estate AIs are trained on US/UK/UAE market assumptions. This one
has the Oman investor thesis burned into its system prompts:

- **ITC (Integrated Tourism Complex) mechanics** — the legal vehicle that
  lets non-Omanis freehold property in Oman, and the residency-linked
  ownership benefit that comes with it.
- **Sultan Haitham City positioning** — the government-backed smart city
  south of Muscat, infrastructure timeline, appreciation thesis.
- **Muscat rental demand model** — who rents where, target-tenant nationalities,
  expected yield bands by unit type and community.
- **Oman-specific pricing in OMR**, not AED or USD.

Every listing, every pitch, every report is built from this shared thesis, so
the brand voice is consistent across the entire inventory and the investor
angle is never diluted.

---

## 3. Primary users

| User | Role | Frequency | Primary needs |
|---|---|---|---|
| **Humood (CEO)** | Primary operator | Daily | Upload projects, spot-check listings, send pitches, export reports to investors |
| **Sales team** | Secondary users | Daily | Generate unit-specific WhatsApp/Instagram copy on demand |
| **Marketing team** | Occasional | Weekly | Batch-export platform-ready listings |
| **Investor clients** | Read-only recipients | Per pitch | Receive branded PDF reports, comparison docs |

---

## 4. Core use cases

### UC1 — Bulk project onboarding
Humood receives a new project from a developer (Sultan Haitham City Phase 2,
say). He uploads the master inventory Excel + brochure PDF + floor plans +
renders. In under 5 minutes the system has 200 units extracted, scored,
photographed (captions), and listing-ready for every platform.

### UC2 — Instant lead response
An investor asks on WhatsApp: *"What 2-bed apartments in ITC zones under
OMR 120k have the best ROI?"* The sales team filters the inventory, clicks
**Generate Comparison Report**, gets a branded 3-unit comparison PDF + a
ready-to-send WhatsApp pitch in Arabic/English — in under 60 seconds.

### UC3 — Instagram/LinkedIn content
The marketing team selects 5 featured units from the week. Clicks
**Generate Instagram Captions**. Gets bilingual captions with hashtags,
hooks, and approved CTAs ready to schedule.

### UC4 — Investor pitch deck
Humood has a meeting with a European investor looking for residency-linked
yield. He filters by ITC status + min 7% yield + 1–4BR. Clicks
**Generate Investor Report**. Gets a branded PDF with 3–5 top units, full
ROI analysis, buyer fit, and appreciation thesis.

---

## 5. Functional requirements

### 5.1 Data ingestion

| Req | Description | MVP |
|---|---|---|
| FR-1.1 | Upload Excel inventory (.xlsx, .xls, .csv) | ✅ |
| FR-1.2 | Upload project brochure (PDF, multi-page) | ✅ |
| FR-1.3 | Upload floor plans (PDF, PNG, JPG) | ✅ |
| FR-1.4 | Upload renders and photos (PNG, JPG, WebP, multiple) | ✅ |
| FR-1.5 | Upload payment plan (PDF or Excel) | ✅ |
| FR-1.6 | Group uploads by Project (one project = one bundle) | ✅ |
| FR-1.7 | Inventory parser tolerates varied column names | ✅ |
| FR-1.8 | Files persisted in Supabase Storage with signed URLs | ✅ |

### 5.2 AI extraction

The AI reads every uploaded file and extracts a canonical Unit record.

| Field | Source priority | Missing behavior |
|---|---|---|
| Project name | Brochure → Excel header → filename | Ask user |
| Developer | Brochure → Excel | "Not in uploaded files" |
| Zone / phase / cluster | Brochure → Excel | "Not in uploaded files" |
| ITC / Freehold status | Brochure → zone lookup table | Flag for user confirmation |
| Unit number | Excel row | Required |
| Unit type | Excel row → brochure | "Not in uploaded files" |
| Bedrooms / bathrooms | Excel | Required |
| Area (sqm) | Excel (preferred) or derived from floor plan | Required |
| Price (OMR) | Excel | Required |
| Payment plan | Payment-plan doc → brochure | Show "Contact agent" |
| Handover date | Brochure → Excel | "TBA" |
| Floor / building | Excel → unit number parsing | "Not specified" |
| View | Excel → floor-plan inspection via vision | Omit |
| Parking | Excel → brochure | Omit |
| Amenities | Brochure | Omit |
| Community features | Brochure | Omit |

**Separation rule (hard):** every extracted field is tagged `source: extracted | inferred | assumed`. The UI shows these visually distinct. The AI never fabricates.

### 5.3 Listing generation (multi-platform)

Output per unit, per platform:

- **Property Finder:** long-form, SEO-structured, EN primary
- **OLX Oman:** scannable, fact-forward, EN + AR
- **Instagram:** hook + body + CTA + hashtags, bilingual caption
- **WhatsApp:** short, investor-voice, one-tap forward, bilingual
- **LinkedIn:** investment-thesis tone, professional, EN
- **Website:** full markdown with sections (hero, highlights, lifestyle,
  specs, amenities, location, pricing, CTA), bilingual

**Structure enforced by `docs/PROMPT_TEMPLATES.md`.**

**Title format (universal):**
`[Unit Type] | Freehold (ITC) for Foreigners | [Project Name] | [Key Feature] | OMR [Price]`

**Character limits enforced per platform** with live counters in the UI.

### 5.4 Client prediction engine

Per unit the AI generates:

- **Ideal buyer type:** investor / end-user / luxury / first-time / foreign expat / GCC buyer (one or multiple).
- **Best nationality segments:** ranked list with brief rationale.
- **Buyer motivation:** 1–2 sentences.
- **Expected rental audience:** tenant profile if rented.
- **Sales angle:** the pitch in one sentence.
- **Objection handling:** 2–3 likely objections and the counter-positioning.

### 5.5 ROI & liquidity analysis

Per unit:

| Score | Scale | Basis |
|---|---|---|
| Rental yield range (gross %) | e.g. 6.5–8.0% | Unit type + area + community benchmark |
| Demand strength | 1–10 | Muscat demand heuristics + community profile |
| Liquidity score | 1–10 | Resale velocity proxy (price bracket, ITC status, handover horizon) |
| ROI score | 1–10 | Composite of yield + appreciation |
| Appreciation score | 1–10 | Location thesis + developer + infra pipeline |

Each score includes a one-line explanation so the broker can defend it to a client.

### 5.6 Comparison reports

Input: filter or client brief ("2BR, ITC, under 120k, 7%+ yield").

Output:
1. Top 3 matching units.
2. Side-by-side price-vs-size, ROI, liquidity comparison.
3. Pros/cons per unit.
4. Final AI recommendation with reasoning.
5. Ready-to-send WhatsApp pitch + branded PDF export.

### 5.7 One-click generation buttons (per unit and batch)

- Generate All Listings (every platform, every language)
- Generate Investor Report (PDF)
- Generate Comparison Report
- Generate WhatsApp Pitch
- Generate Instagram Caption
- Export PDF
- Export Excel

### 5.8 Branding

Every output carries:
- Alwalaa logo + contact block
- Footer: "Prepared for: Humood Aladhari · Alwalaa Real Estate"
- Brand palette: black (#0A0A0A), gold (#D4A017), white (#FFFFFF)

### 5.9 Audit trail

Every listing stores:
- The exact prompt used
- The model version
- The source file IDs
- Timestamp
- Human edits (if any)

This is how we diagnose regressions and defend accuracy claims to investors.

---

## 6. Non-functional requirements

| # | Requirement |
|---|---|
| NFR-1 | Extraction + full-platform listing generation: **under 90 seconds per unit**, **under 10 minutes per 100-unit project** (parallelized) |
| NFR-2 | Arabic output must be right-to-left, proper diacritics, no English bleed |
| NFR-3 | Prices always OMR primary with USD/EUR/INR conversions shown |
| NFR-4 | No AI-fabricated numbers — every stated fact traceable to a source file |
| NFR-5 | Access is private: Humood + invited team members only (Supabase Auth) |
| NFR-6 | Works on laptop AND phone browser (responsive) |
| NFR-7 | Mobile-friendly "copy" buttons for every listing block |
| NFR-8 | Free-tier friendly: Vercel + Supabase + Anthropic pay-as-you-go |

---

## 7. Out of scope (MVP)

- CRM / lead pipeline tracking (future v2)
- Automated posting to portals (future v2 — needs portal API partnerships)
- Buyer-facing public site
- Currency live-rate feed (uses a periodically-updated static table)
- Multi-tenant (only Alwalaa for now)
- Video generation

---

## 8. Success metrics

| Metric | Target |
|---|---|
| Time from upload to first published listing | < 5 min |
| Listings generated per month | > 500 |
| Broker-reported "accuracy acceptable" | > 95% |
| Percentage of listings published without edits | > 70% |
| WhatsApp pitch → meeting booked conversion (tracked manually) | measure & improve |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI fabricates facts | Source-tagging (extracted/inferred/assumed) + audit trail |
| ITC status misidentified | Hand-curated zone lookup table + user confirmation step |
| Arabic quality drops on long copy | Dedicated Arabic-native prompt + AR review step before publish |
| Runaway API cost on large projects | Cache system prompt; cap per-project spend via env variable |
| Developer brochure PDFs are image-scanned | Vision fallback on per-page basis |
| Regulations change on foreign ownership | ITC zone lookup is versioned and editable via admin page |
