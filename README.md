# Alwalaa AI Listing Agent

AI-powered property-listing generator for the Alwalaa brokerage. Takes an
inventory sheet plus optional renders and sales-offer PDFs, researches the
live market, and produces ready-to-publish listings across the Alwalaa
website, Instagram, Dubizzle, OpenSouq, Bayut, and Property Finder — in
English and Arabic, with multi-currency pricing, branded CTAs, and
platform-specific character limits enforced automatically.

## What it does

- **Reads your inventory** — CSV or Excel. Tolerant column mapping: `beds`,
  `bedrooms`, `br` all map to the same field.
- **Analyzes your renders** — Claude's vision API captions each image, tags
  the room, and flags hero-shot candidates.
- **Extracts sales-offer PDFs** — pulls the text so the model can cite the
  facts you put in your own collateral.
- **Researches the market** — Claude uses the web-search tool to find 3-6
  recent comparable listings on Bayut, Property Finder, Dubizzle, etc.,
  then synthesizes a price range and positioning note.
- **Writes per-platform listings** — one markdown file per platform and
  language, with the approved brand CTAs and an enforced character budget.
- **Builds multi-currency price tables** — AED/USD/EUR/GBP/SAR by default,
  configurable.
- **Stays on brand** — the voice, visual palette, forbidden words,
  preferred verbs, and compliance disclosures live in `config/branding.yaml`
  and are pushed into a cached system prompt, so every call after the first
  is cheap.

## Repository layout

```
.
├── cli.py                        # CLI entry point
├── config/
│   ├── branding.yaml             # Alwalaa brand book (tone, colors, CTAs, amenities)
│   └── platforms.yaml            # Platform rules (char limits, languages, sections)
├── property_agent/
│   ├── models.py                 # Pydantic models (Property, Listing, ...)
│   ├── inputs.py                 # Inventory/PDF/render ingestion
│   ├── pricing.py                # Multi-currency price tables
│   ├── prompts.py                # System + user prompt templates
│   ├── agent.py                  # Claude orchestrator (vision + web search + copy)
│   └── output.py                 # Disk writer (one folder per property)
├── sample_data/
│   └── sample_inventory.csv      # 4 example properties
└── requirements.txt
```

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# add your ANTHROPIC_API_KEY to .env
```

## Launch the web app (recommended)

```bash
streamlit run app.py
```

Opens at `http://localhost:8501`. From the browser you can:

- **Upload an inventory** (CSV/XLSX) and see every property listed.
- **Attach renders and a sales-offer PDF** per property.
- **Pick platforms and currencies** in the sidebar.
- **Generate** with one click — you'll see live progress (vision, market
  research, copywriting).
- **Copy** the title, body, CTA, and hashtags per platform with character
  counters that turn red when over the limit.
- **Download all listings as a ZIP** ready to hand to the marketing team.

There's also a **Single property** tab with a quick form if you don't want
to upload a full inventory.

## CLI

For batch jobs, automation, or CI use the CLI.

### Generate for every property in an inventory

```bash
python cli.py batch --inventory sample_data/sample_inventory.csv
```

### Single property with renders and a sales offer

```bash
python cli.py single \
    --inventory sample_data/sample_inventory.csv \
    --reference ALW-PALM-2045 \
    --renders "renders/palm/*.jpg" \
    --offer offers/palm_2045.pdf \
    --platform website \
    --platform instagram
```

### Skip market research (faster, offline-friendlier)

```bash
python cli.py batch --inventory inv.csv --no-research
```

### Change target currencies

```bash
python cli.py batch --inventory inv.csv --currencies "AED,USD,EUR,INR,CNY,RUB"
```

## Output

Each property gets a folder under `./generated/<reference_id>/`:

```
generated/ALW-PALM-2045/
├── website_en.md
├── website_ar.md
├── instagram_en.md
├── instagram_ar.md
├── dubizzle_en.md
├── opensouq_en.md
├── opensouq_ar.md
├── bayut_en.md
├── property_finder_en.md
├── market_research.md
└── listing.json                  # everything, machine-readable
```

Each `.md` is ready to paste into the target platform.

## Tuning the brand

Everything the copywriter AI knows about Alwalaa lives in
`config/branding.yaml`. Edit the brand voice, color palette, amenity
vocabulary, compliance disclosures, or the approved CTA list and the next
`python cli.py ...` run picks it up — no code changes.

Platform rules (character limits, required sections, language set, hashtag
policy) live in `config/platforms.yaml`. Add a new portal by appending a
block there.

## How it uses Claude

- **Model:** `claude-opus-4-7` throughout.
- **Adaptive thinking** on every listing call, so the model chooses how
  hard to think based on complexity.
- **Prompt caching** on the brand book + platform specs — the stable
  ~10-20K-token system prompt is cached with `cache_control: ephemeral`,
  so every call after the first pays ~10% of the input price on that
  prefix.
- **Vision** for render analysis (base64 inline; swap in the Files API if
  you have hundreds of images).
- **Web search server tool** for market research — Claude runs the
  comparable-listing queries itself.
- **Strict JSON outputs** parsed defensively (code-fence stripping,
  balanced-brace extraction).

## Extension points

- Swap `EXCHANGE_RATES` in `property_agent/pricing.py` for a live FX feed.
- Add platforms by appending to `config/platforms.yaml`.
- Plug a Files API uploader into `inputs.py` if render galleries grow large.
- Add a Skills-based backend for per-user memory of broker preferences.
