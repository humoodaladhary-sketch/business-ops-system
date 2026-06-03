# UI / UX Wireframes — Alwalaa AI Listing Agent

Low-fidelity wireframes for MVP. The design language is **black · gold · white**
per the Alwalaa logo. Typography: bold sans-serif for headers, lighter weight
for body copy. The app feels like a private investor dashboard, not a consumer
real-estate site.

---

## 0. Global chrome

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬛W و   ALWALAA            Dashboard  Inventory  Reports     [HA] │
│          real estate                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     (page content)                                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Alwalaa Real Estate · Prepared for: Humood Aladhari · v1.0         │
└─────────────────────────────────────────────────────────────────────┘
```

- Logo mark on the left, wordmark + "real estate" (gold).
- Top nav: Dashboard / Inventory / Reports.
- Top right: initials avatar with dropdown (profile, sign out).
- Footer is a single line in muted gray; prints on every exported PDF too.

---

## 1. Dashboard (`/`)

```
┌──────────────── DASHBOARD ──────────────────────────────────────────┐
│                                                                     │
│   Quick stats                                                       │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐ │
│   │ 4            │ │ 187          │ │ 142          │ │ 28        │ │
│   │ Projects     │ │ Units        │ │ Listings     │ │ Reports   │ │
│   └──────────────┘ └──────────────┘ └──────────────┘ └───────────┘ │
│                                                                     │
│   [ + NEW PROJECT ]  ← gold button, primary CTA                    │
│                                                                     │
│   Recent projects                                                   │
│   ┌──────────────────────────────┐ ┌──────────────────────────────┐ │
│   │ Sultan Haitham City Ph. 1    │ │ AIDA                         │ │
│   │ Muscat · ITC Freehold        │ │ Muscat · ITC Freehold        │ │
│   │ 54 units · 42 listed         │ │ 88 units · 73 listed         │ │
│   │ [ Open → ]                   │ │ [ Open → ]                   │ │
│   └──────────────────────────────┘ └──────────────────────────────┘ │
│                                                                     │
│   Recent activity                                                   │
│   • Generated 6 listings for ALW-SHC-A-1204      2 hours ago       │
│   • Created comparison report (3 units)          5 hours ago       │
│   • Uploaded payment plan for "AIDA Apt 2214"    yesterday         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Upload / New project (`/upload`)

```
┌──────────────── NEW PROJECT ────────────────────────────────────────┐
│                                                                     │
│   1. Project details                                                │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │ Name:  [Sultan Haitham City — Phase 1 ▸]                     │ │
│   │ Dev:   [Oman Diwan of Royal Court ▸]                         │ │
│   │ Zone:  [SHC-A ▸]                                             │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│   2. Drop files — the AI figures out what each one is               │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │   ┌─┐                                                        │ │
│   │   │↑│   Drop Excel, PDF, and images here                     │ │
│   │   └─┘   or click to browse                                   │ │
│   │                                                              │ │
│   │   Accepted: .xlsx .xls .csv .pdf .jpg .png .webp             │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│   Uploaded (5)                                                      │
│   📊 inventory-phase-1.xlsx          auto-tagged: inventory         │
│   📄 brochure-shc-a.pdf              auto-tagged: brochure          │
│   📄 payment-plan-shc-a.pdf          auto-tagged: payment_plan      │
│   🖼  render-aerial.jpg               auto-tagged: render (hero)    │
│   🖼  floor-plan-apt-typical.png      auto-tagged: floor_plan       │
│                                                                     │
│   [ ⚙ EXTRACT UNITS ]  ← kicks off AI extraction                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Extraction runs in a status dialog:

```
┌─ Extracting units… ──────────────────────────────────────┐
│ ✓ Parsed Excel:          54 rows detected                │
│ ✓ Parsed brochure:       12 pages, 8,400 tokens          │
│ ⋯ Analyzing 3 renders…                                   │
│ ⋯ Normalizing units (Claude Opus 4.7, adaptive thinking) │
│                                                          │
│     [ ████████████░░░░░ ] 68%                            │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Inventory list (`/inventory`)

```
┌──────────────── INVENTORY ──────────────────────────────────────────┐
│                                                                     │
│  Filter:   Project ▾   Type ▾   Bedrooms ▾   Ownership ▾   Price ⇅ │
│            [ITC only ☑]   [Min yield 7% ⇅]                          │
│                                                                     │
│  187 units matching                                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ALW-SHC-A-1204  ·  2BR Apartment  ·  Sultan Haitham City    │   │
│  │ 96 sqm  ·  OMR 108,500  ·  ITC Freehold                     │   │
│  │ Yield 7.0–8.5%  ·  ROI ●●●●●●●●○○ (8)                       │   │
│  │ Buyer: Foreign expat investor (EU, India)                   │   │
│  │ [ Open → ]  [ ⚡ Generate listings ]                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ALW-AIDA-B-2214  ·  3BR Sky Villa  ·  AIDA                  │   │
│  │ 242 sqm  ·  OMR 425,000  ·  ITC Freehold                    │   │
│  │ Yield 5.5–6.5%  ·  ROI ●●●●●●●○○○ (7)                       │   │
│  │ Buyer: Luxury end-user / GCC family                         │   │
│  │ [ Open → ]  [ ⚡ Generate listings ]                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Bulk: [ ⚡ Generate listings for ALL (187 units) ]                │
│        [ 📊 Generate Comparison Report from selected ]              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Unit detail (`/units/[id]`)

Tabbed layout.

```
┌──────────────── ALW-SHC-A-1204 ─────────────────────────────────────┐
│  Sultan Haitham City · Building A · 2BR Apartment                   │
│  OMR 108,500   ·   96 sqm   ·   ITC Freehold                        │
│                                                                     │
│  ┌ OVERVIEW ┬ LISTINGS ┬ BUYER ┬ ROI ┬ FILES ┬ AUDIT ┐              │
│  │                                                                  │
│  │  HERO RENDER [wide]                                              │
│  │                                                                  │
│  │  SPEC TABLE                         ROI SCORES                   │
│  │  Bedrooms       2                   Yield       7.0–8.5%         │
│  │  Bathrooms      2.5                 Demand      ●●●●●●●●○○  8    │
│  │  Area           96 sqm [extr.]      Liquidity   ●●●●●●●○○○  7    │
│  │  Price          OMR 108,500 [extr.] ROI         ●●●●●●●●○○  8    │
│  │  View           Partial sea [infer] Appreciation●●●●●●●●●○  9    │
│  │  Parking        1 [missing]                                      │
│  │  Ownership      Freehold (ITC)                                   │
│  │  Handover       Q4 2026 [extr.]                                  │
│  │                                                                  │
│  │  BUYER ANGLE                                                     │
│  │  Primary: Foreign expat investor                                 │
│  │  Nationalities: European · Indian · GCC                          │
│  │  Pitch: "Residency-linked ownership in a state-backed            │
│  │         smart city with 8% yield from Muscat's expat base."      │
│  │                                                                  │
│  │  ONE-CLICK ACTIONS                                               │
│  │  [ ⚡ Generate all listings (6 platforms × 2 langs) ]            │
│  │  [ 💬 Generate WhatsApp pitch ]                                  │
│  │  [ 📷 Generate Instagram caption ]                               │
│  │  [ 📄 Export investor PDF ]                                      │
│  └──────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

### LISTINGS tab

Per platform × language: title (with character count), body textarea, CTA,
hashtags, **copy** and **edit** buttons, **download .md** button. Warning
banner if the AI left anything flagged `assumed`.

```
┌ LISTINGS ──────────────────────────────────────────────────────────┐
│                                                                    │
│ ┌ property_finder · en ┬ olx_oman · en ┬ olx_oman · ar ┬ ... ┐     │
│                                                                    │
│   TITLE                                              72/100 ✓      │
│   ┌────────────────────────────────────────────────────────────┐  │
│   │ 2BR Apartment | Freehold (ITC) for Foreigners |            │  │
│   │ Sultan Haitham City | OMR 108,500                          │  │
│   └────────────────────────────────────────────────────────────┘  │
│   [ 📋 Copy ]                                                      │
│                                                                    │
│   BODY                                             2,340/5,000 ✓   │
│   ┌────────────────────────────────────────────────────────────┐  │
│   │ Own a residence in the government-backed smart city that   │  │
│   │ is redefining Muscat...                                    │  │
│   │                                                            │  │
│   │ (long body with specs, ROI angle, CTA)                     │  │
│   └────────────────────────────────────────────────────────────┘  │
│   [ 📋 Copy ]   [ ✏  Edit inline ]                                 │
│                                                                    │
│   CTA   Request the Sultan Haitham City investor pack             │
│                                                                    │
│   HASHTAGS  (Instagram only)                                       │
│   #AlwalaaHomes #OmanInvestment #SultanHaithamCity #FreeholdOman   │
│                                                                    │
│ [ ⬇ Download all platforms as ZIP ]   [ 🔄 Regenerate ]            │
└────────────────────────────────────────────────────────────────────┘
```

### AUDIT tab

Source-tagged table. Each row: field, value, source (extracted/inferred/
assumed/missing) colored badge, source file link, confidence %, reasoning.

```
┌ AUDIT — source traceability ───────────────────────────────────────┐
│ Field         Value          Source       File             Conf   │
│ ─────────── ─────────────── ─────────── ────────────────── ────── │
│ bedrooms    2               EXTRACTED   inventory.xlsx    1.00   │
│ area_sqm    96              EXTRACTED   inventory.xlsx    1.00   │
│ price_omr   108500          EXTRACTED   inventory.xlsx    1.00   │
│ view        Partial sea     INFERRED    brochure.pdf      0.78   │
│ parking     —               MISSING     —                 —      │
│ itc_status  freehold_itc    INFERRED    zone lookup       0.95   │
│ handover    2026-12-01      EXTRACTED   brochure.pdf      0.92   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Reports (`/reports`)

```
┌──────────────── REPORTS ────────────────────────────────────────────┐
│                                                                     │
│ [ + NEW COMPARISON REPORT ]   [ + NEW INVESTOR PITCH ]              │
│                                                                     │
│ Recent                                                              │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Comparison · 3 units in SHC Phase 1 · under OMR 150k        │    │
│ │ Created 5h ago · [Open] [Download PDF] [Copy WhatsApp]      │    │
│ └─────────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Investor · AIDA sky villas (5 units)                        │    │
│ │ Created 2d ago · [Open] [Download PDF]                      │    │
│ └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### New comparison flow

Step 1 — brief:

```
┌ STEP 1: what is the client looking for? ───────────────────────────┐
│ Client brief (free text):                                          │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ European investor, looking for residency-linked freehold     │   │
│ │ under OMR 150k, 2BR, yield at least 7%.                      │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ Or use structured filters:                                         │
│   Budget max: [150000] OMR   Bedrooms: [2]                         │
│   Ownership: [ITC ☑]         Min yield: [7.0%]                     │
│                                                                    │
│ [ FIND TOP 3 → ]                                                   │
└────────────────────────────────────────────────────────────────────┘
```

Step 2 — AI result (comparison table, pros/cons, recommendation, WhatsApp
pitch) with Copy & Export PDF.

---

## 6. Empty / loading / error states

- **Empty dashboard** (first run): full-width CTA "Upload your first project"
  centered, gold button.
- **Extraction in progress**: status dialog as shown in §2.
- **API failure**: inline red banner with request ID and "Retry" button.
- **AI returned `assumed` values**: amber badge in the audit tab and a
  toast on listing generation — "2 fields assumed; review before publishing".

---

## 7. Responsive notes

- Tablet (≥ 768px): nav collapses into drawer, 2-column dashboard.
- Phone (< 768px): single column. All "Copy" buttons become large enough to
  tap. Tabbed layout on unit detail page becomes a scrollable segmented
  control.
