# Developer Inventory Module

Ingest messy developer inventory → normalize with AI → analyze → generate
brand-aligned listings. Built as a clean vertical slice with strict layer
separation so the same domain logic runs in this app, in N8N, and behind the
WhatsApp bot.

## Architecture (four layers, strictly separated)

```
src/domain/inventory/      Pure TS. Schema (zod) + analytics. Zero IO. Unit-tested.
src/ai/                    Anthropic calls: normalizeInventory, generateListing.
src/storage/inventory/     Persistence behind InventoryRepository (adapter pattern).
src/components/dev-inventory/  UI (tabs). No business logic.
src/app/api/inventory/...  Framework routes wrapping domain+ai+storage (N8N webhooks).
```

The domain layer imports only `zod`. It contains no React, no `fetch`, no
storage — so it ports cleanly into other runtimes.

## Files

| Path | Responsibility |
|---|---|
| `domain/inventory/unit.ts` | Canonical `UnitSchema` (zod) + `UnitDraftSchema` (lenient AI input) + `deriveId`, `derivePricePerSqm`, `parseUnitRows` (drop+report) |
| `domain/inventory/money.ts` | OMR formatting (pure) |
| `domain/inventory/analytics.ts` | `computeKpis`, `extremesByCategory`, `pricePerSqmByProject`, `priceBandByProject`, `unitTypeDistribution`, `comparisonMatrix`, `recentMovements` |
| `domain/inventory/__tests__/*` | Vitest coverage incl. nulls, single-unit categories, empty input |
| `ai/normalizeInventory.ts` | Raw text → `Unit[]` + dropped-row report. Reuses `lib/anthropic.ts` |
| `ai/generateListing.ts` | Brand listing copy (EN/AR) + no-AI template fallback |
| `storage/inventory/InventoryRepository.ts` | Interface + `PriceMovement` + pure `diffInventory` / `previewDiff` |
| `storage/inventory/supabaseInventoryRepository.ts` | Supabase adapter (tables `dev_units`, `dev_price_movements`) |
| `storage/inventory/inMemoryInventoryRepository.ts` | Fallback adapter (tests / no-env) |
| `storage/inventory/index.ts` | `getInventoryRepository()` factory (Supabase if env present, else in-memory) |

## Setup

1. Already part of the `web/` Next.js app — no separate install.
2. Run `docs/DEV_INVENTORY_SCHEMA.sql` in Supabase (adds `dev_units` +
   `dev_price_movements`). Without Supabase env vars the module runs on the
   in-memory adapter automatically.
3. `npm run test` runs the domain unit tests. `npm run typecheck` for types.
4. Open `/dev-inventory` in the app.

## API contract (for N8N / integrations)

All routes are JSON. Base path `/api`.

### `POST /inventory/normalize`
Body: `{ "text": string }`
Returns:
```json
{
  "ok": true,
  "units": [ /* validated Unit[] */ ],
  "errors": [ { "index": 0, "message": "..." } ],
  "preview": [ { "unit": {...}, "kind": "new|price-changed|changed|unchanged", "oldPrice": null, "deltaPct": null } ],
  "rawRowCount": 12
}
```
Does NOT persist. Confirm, then call `/inventory/commit`.

### `POST /inventory/commit`
Body: `{ "units": Unit[] }` (the confirmed rows)
Returns: `{ "ok": true, "inserted": n, "updated": n, "unchanged": n, "movements": PriceMovement[] }`

### `GET /inventory`
Query (all optional): `project, unitType, status, itc=1, minPrice, maxPrice`
Returns: `{ "ok": true, "count": n, "units": Unit[] }`

### `GET /analytics`
Query: `movementDays` (default 30)
Returns the full analytics bundle (kpis, extremes, bands, distribution,
comparison matrix, recent movements).

### `POST /listings/generate`
Body: `{ "unit": Unit, "language": "en" | "ar" }`
Returns: `{ "ok": true, "copy": { headline, keyFacts[], description, cta }, "source": "ai" | "template" }`

## Pointing N8N at it

1. Deploy the app (Vercel). Your base URL is e.g. `https://<app>.vercel.app`.
2. In N8N use **HTTP Request** nodes:
   - Normalize a WhatsApp message → `POST {BASE}/api/inventory/normalize` with `{ "text": "{{$json.body}}" }`.
   - Auto-commit (skip human review) → pipe `units` from the previous node into
     `POST {BASE}/api/inventory/commit`.
   - Daily price-movement digest → `GET {BASE}/api/analytics?movementDays=1`,
     then format `recentMovements` into a Slack/WhatsApp broadcast.
   - Generate listing for Canva/Lofty/Follow Up Boss → `POST {BASE}/api/listings/generate`.
3. Because the domain + storage logic is identical to the in-app path, N8N,
   the WhatsApp bot, and the dashboard all stay consistent.

## Conventions

- Strict TypeScript, no `any`. All external boundaries validated with zod.
- Bad rows are dropped and reported, never fatal.
- OMR formatting is centralized in `money.ts`.
- The AI client is the existing `lib/anthropic.ts` (one client, cached system prompt).
