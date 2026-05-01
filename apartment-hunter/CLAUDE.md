# Apartment Hunter POA — Architecture & Project Plan

## Project Goal

A personal, automated apartment hunting tool for Porto Alegre, Brazil. It scrapes real estate portals daily, deduplicates and normalizes listings, ranks them against personal search criteria using deterministic rules and AI qualitative scoring, and delivers the best options by email every morning.

**The outcome:** Every morning, a ranked, curated list of new apartments arrives in the inbox. No browsing portals. No manual filtering.

---

## Decisions Made

| Decision | Choice | Notes |
|----------|--------|-------|
| Notifications | **Email only** (Resend) | Daily digest of top ranked new listings |
| Cloud deployment | **Fly.io + GitHub Actions** (free) | Modular — easy to switch to Railway ($5/mo) |
| Search scope | **Porto Alegre only** | All 85 neighborhoods covered |
| AI provider | **Claude** (Anthropic SDK) | Modular AIProvider interface — easy to swap to OpenAI |
| AI demo mode | **`claude -p` script** | First demo can use the Claude CLI subprocess instead of SDK |
| Profiles | **Single user** | No multi-profile needed |
| Data retention | **Manual per listing** | UI button: user decides to archive or delete removed listings |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14 (App Router) | Full-stack: API routes + UI in one repo |
| UI | Mantine v7 + Tabler Icons | Fast to build, dark mode, responsive |
| Database | SQLite (better-sqlite3, WAL mode) | Zero-ops, zero cost, sufficient for personal use |
| AI Ranking | Claude API via `AIProvider` interface | Swappable — Claude today, any provider tomorrow |
| Notifications | Resend (email) | Free tier: 3,000 emails/month |
| Logging | pino + pino-pretty | Structured logs for debugging scrape runs |
| Runtime | Node.js (TypeScript) | Consistent across scrapers, API, and scripts |
| Hosting | Fly.io (persistent volume) | Free tier with 3GB volume for SQLite |
| Scheduling | GitHub Actions cron | Free, triggers daily scrape via HTTP |

---

## Full Pipeline: Start to Finish

```
[GitHub Actions Cron: 7am BRT daily]
        │
        ▼
POST /api/scrape/run  (SCRAPE_API_KEY header required)
        │
        ├── VivaReal Scraper    (done)
        ├── ZAP Imóveis Scraper (next priority)
        ├── QuintoAndar Scraper (planned)
        └── OLX Imóveis Scraper (future)
        │
        ▼
Ingest Pipeline (src/lib/ingest.ts)
  - Normalize fields (lowercase, strip accents)
  - Deduplicate across portals (address + area bucket + price bucket)
  - Upsert listings table
  - Insert price snapshots (listing_snapshots)
  - Record scrape run stats (scrape_runs)
        │
        ▼
Ranking Pipeline (src/ranking/)
  Stage 1 — Hard Filter     (eliminates outside criteria: price, area, beds, condo fee)
  Stage 2 — Deterministic   (0–60pts: price fit, area, bedrooms, condo fee, neighborhood)
  Stage 3 — AI Score        (0–40pts: AIProvider reads top 30, scores qualitative factors)
        │
        ▼
Email Notification (src/notifications/email.ts)
  - Resend API: HTML digest of top 10 new listings
  - Includes: score, AI rationale, price, area, neighborhood, link to portal
  - Sent only when listings_new > 0
        │
        ▼
Next.js UI (running on Fly.io)
  /           — new listings today, ranked
  /all        — full table of all active listings
  /listing/id — detail view: price history, sources, AI rationale
  /profile    — configure search filters
  /runs       — scraper execution history
```

---

## Modular AI Provider Interface

The AI layer is abstracted behind an `AIProvider` interface so the underlying model can be swapped without touching ranking logic.

### Interface (src/ranking/ai-provider.ts)

```typescript
export interface AIProvider {
  name: string;
  scoreListings(
    listings: ListingForRanking[],
    profile: FilterProfile
  ): Promise<AIScore[]>;
}

export interface AIScore {
  listingId: string;
  score: number;      // 0–40
  rationale: string;  // Portuguese explanation
}
```

### Implementations

**ClaudeProvider** (`src/ranking/providers/claude.ts`)
- Uses `@anthropic-ai/sdk` directly
- Default for production
- Env: `ANTHROPIC_API_KEY`

**ClaudeCLIProvider** (`src/ranking/providers/claude-cli.ts`)
- Uses `child_process` to call `claude -p "<prompt>"` as a subprocess
- For demos and local testing without an API key configured
- Falls back gracefully if `claude` CLI is not installed
- Env: none required (uses whatever the CLI session has)

**OpenAIProvider** (`src/ranking/providers/openai.ts`) — future
- Drop-in replacement using `openai` npm package
- Env: `OPENAI_API_KEY`

### Provider Selection (src/ranking/index.ts)

```typescript
function getAIProvider(): AIProvider {
  if (process.env.AI_PROVIDER === 'claude-cli') return new ClaudeCLIProvider();
  if (process.env.AI_PROVIDER === 'openai')     return new OpenAIProvider();
  return new ClaudeProvider();  // default
}
```

Environment variable `AI_PROVIDER` controls which is used. No code changes needed to switch.

---

## Modular Deployment Design

The app is designed so the same codebase runs identically on Fly.io (free) or Railway ($5/mo). The only difference is infra config files.

### Current Target: Fly.io + GitHub Actions (free)

**Fly.io** hosts the Next.js app with a 3GB persistent volume for SQLite.

```toml
# fly.toml
[mounts]
  source = "apartment_hunter_data"
  destination = "/app/data"

[env]
  DB_PATH = "/app/data/listings.db"
  PORT = "3000"
```

**GitHub Actions** triggers the daily scrape via HTTP:

```yaml
# .github/workflows/daily-scrape.yml
on:
  schedule:
    - cron: '0 10 * * *'   # 10:00 UTC = 07:00 BRT
  workflow_dispatch:         # also allows manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger scrape
        run: |
          curl -s -X POST ${{ secrets.APP_URL }}/api/scrape/run \
            -H "X-API-Key: ${{ secrets.SCRAPE_API_KEY }}" \
            -H "Content-Type: application/json"
```

### Switching to Railway (one-time migration)

To switch from Fly.io to Railway:
1. Create Railway project, attach persistent volume at `/app/data`
2. Copy environment variables from Fly.io secrets to Railway
3. Delete `fly.toml`, add `railway.json` (or use Railway's auto-detect)
4. Disable the GitHub Actions workflow (Railway has native cron)
5. Add Railway cron: `0 10 * * *  curl -X POST $RAILWAY_INTERNAL_URL/api/scrape/run -H "X-API-Key: $SCRAPE_API_KEY"`

No application code changes required.

---

## Scraper Architecture

### Goal
Find every apartment for sale in Porto Alegre that meets base criteria (price, area), across all major portals, before 7am.

### Base Scraper (src/scrapers/_base.ts)
All scrapers extend `BaseScraper`:
- `robots.txt` check and in-memory caching per host
- Rate limiting: 2000ms ± 20% jitter between requests
- Exponential backoff on HTTP 429 / 503
- Raw response storage in `data/raw/<source>/`
- Abstract method: `scrape(profile: FilterProfile): Promise<RawListing[]>`

### VivaReal Scraper (src/scrapers/vivareal.ts) — DONE
- JSON API: `https://glue-api.vivareal.com.br/v2/listings`
- 36 items per page, up to 1000 listings per run
- Filters by price range server-side
- Porto Alegre, RS — APARTMENT — SALE

### ZAP Imóveis Scraper (src/scrapers/zap.ts) — NEXT PRIORITY
- Same OLX Group as VivaReal, nearly identical API structure
- JSON API: `https://glue-api.zapimoveis.com.br/v2/listings`
- Same field mapping, same pagination pattern
- Doubles listing coverage for minimal implementation effort

### QuintoAndar Scraper (src/scrapers/quintoandar.ts) — PLANNED
- Primarily a rental platform but has a growing sales section (`/comprar`)
- Uses an internal GraphQL-like API (requires reverse-engineering browser requests)
- Higher effort than ZAP but worthwhile coverage for Porto Alegre sales
- Must filter to `business_type=SALE` only — ignore rental listings

### OLX Imóveis Scraper — FUTURE
- General marketplace, lower listing quality, lower priority

### Deduplication Strategy (src/lib/ingest.ts)
When the same physical apartment appears on multiple portals:
1. Normalize address (lowercase, strip accents and punctuation)
2. Bucket area to nearest 2 m²
3. Bucket price to nearest R$10k
4. Dedupe key: `{normalized_address}|{area_bucket}|{price_bucket}`
5. Fallback key: `{source}:{external_id}` (if address is missing)
6. On collision: merge into `listing_sources`, insert new snapshot

---

## Database Schema (SQLite)

### filter_profiles
User's search criteria. One row marked `is_active = true` at a time.
- `filters` JSON: priceMin, priceMax, areaMin, bedroomsMin, condoFeeMax, neighborhoods[], excludedKeywords[], petsAllowed

### listings
One row per unique physical apartment (deduplicated across portals).
- UUID PK, `dedupe_key` UNIQUE, all normalized fields
- `status`: active | inactive | removed
- `interest_level`: null | thumbs_up | thumbs_down (user feedback)
- `first_seen_at`, `last_seen_at`, `last_checked_at`

### listing_sources
Which portals each listing appears on. Composite PK `(listing_id, source)`.
- `external_id`, `url`, `first_seen_at`, `last_seen_at`

### listing_snapshots
Price history. One row per scrape per listing.
- Enables price drop detection and relisting detection
- `raw_payload` JSON for debugging

### scrape_runs
Execution log per scraper invocation.
- `status`: running | success | error
- `listings_found`, `listings_new`, `listings_updated`, `errors` JSON

### rankings
AI + deterministic scores per listing per active profile.
- Composite PK `(listing_id, profile_id)`
- `score` (0–100), `rationale` (Portuguese), `ranked_at`

---

## AI Ranking: Role of Claude

### Scoring Pipeline (src/ranking/)

**Stage 1 — Hard Filter** (`deterministic.ts`)
Eliminates listings outside hard boundaries:
- Price: `priceMin ≤ price ≤ priceMax`
- Condo fee: `condo_fee ≤ condoFeeMax`
- Area: `area ≥ areaMin`
- Bedrooms: `bedrooms ≥ bedroomsMin`
- Keyword exclusion: title or description contains excluded word
- Pets: listing forbids pets when profile requires them

**Stage 2 — Deterministic Score** (0–60pts)
- Price fit (0–20): how centered price is within range
- Area fit (0–15): bonus if area ≥ areaMin × 1.5
- Bedrooms (0–10): 10pts if above min, 8pts if exactly min
- Condo fee (0–10): lower is better
- Neighborhood (0–5): +5 if matched preference, +2 if no preference set

**Stage 3 — AI Qualitative Score** (0–40pts)
Top 30 deterministic scorers sent to the configured `AIProvider`.
Claude evaluates (in Portuguese):
- Finishing quality signals (porcelanato, granito, planejados, etc.)
- Sun and light orientation mentions (sol da manhã, frente norte, etc.)
- Building age and renovation status
- Amenities (academia, piscina, portaria 24h, salão de festas)
- Description credibility — penalizes vague or template-looking listings
- Price vs. apparent quality signal

**Final score** = Deterministic + AI (0–100)

### Planned Improvements

**User Feedback Loop**
- `interest_level` column already planned in schema (thumbs_up / thumbs_down)
- After ~10 ratings, include examples in Claude prompt:
  - "The user liked: [3 example descriptions]. The user disliked: [3 examples]."
- Personalizes ranking over time without any retraining

**Price Signal Injection**
- Pass snapshot delta to Claude: "Price dropped R$50k in 45 days"
- Claude weighs urgency vs. potential red flag

**Neighborhood Notes**
- Freetext field in filter profile per neighborhood
- Example: "Moinhos de Vento: prefer near Parcão, avoid Av. Ipiranga corridor"
- Included in Claude prompt for richer neighborhood context

---

## Email Notifications (Resend)

### Implementation (src/notifications/email.ts)

Triggered automatically at the end of each successful scrape run when `listings_new > 0`.

**Email content:**
- Subject: `🏠 X novos apartamentos encontrados — DD/MM/YYYY`
- Top 10 new listings ranked by score
- Per listing: title, neighborhood, price, area, bedrooms, condo fee, score badge, AI rationale (Portuguese), link to portal

**Resend setup:**
- Free tier: 3,000 emails/month, 100/day
- Env: `RESEND_API_KEY`, `EMAIL_TO`, `EMAIL_FROM`

**Modular interface** (`src/notifications/notifier.ts`):
```typescript
export interface Notifier {
  send(listings: RankedListing[], runStats: ScrapeStats): Promise<void>;
}
```
`EmailNotifier` implements this. Adding Slack, WhatsApp, or Telegram later requires only a new class.

---

## Data Retention

Listings with `status = removed` (no longer appearing on portals) are **not auto-deleted**.

The listing detail page (`/listing/[id]`) shows a banner for removed listings with two manual actions:
- **Archive** — keeps the record, marks it `status = archived`, hides from all active views
- **Delete** — permanently removes listing and all associated snapshots, sources, and rankings

The `/all` page table includes a filter toggle: "Show removed listings" (off by default).

---

## What to Build Next (Priority Order)

1. **Deploy to Fly.io** — `fly launch`, attach volume, set secrets, verify app runs
2. **GitHub Actions cron** — `.github/workflows/daily-scrape.yml`, test manual trigger
3. **Resend email notification** — `src/notifications/email.ts` + trigger after ranking
4. **ZAP Imóveis scraper** — `src/scrapers/zap.ts`, doubles coverage (same OLX Group API as VivaReal)
5. **QuintoAndar scraper** — `src/scrapers/quintoandar.ts`, needs API reverse-engineering from browser devtools
6. **Wire price drop detection** — compare snapshots, set `isPriceDrop` flag in `ListingCard`
7. **Manual data retention UI** — archive/delete buttons on removed listings
8. **User feedback (thumbs up/down)** — `interest_level` on listings, feeds back into AI prompt
9. **ClaudeCLIProvider** — `claude -p` subprocess for demo mode without SDK key

---

## Environment Variables

```bash
# AI Provider
ANTHROPIC_API_KEY=          # For ClaudeProvider (default)
AI_PROVIDER=                # Options: '' (claude sdk), 'claude-cli', 'openai'
OPENAI_API_KEY=             # For OpenAIProvider (future)

# Scraping
SCRAPE_API_KEY=             # Auth header required on /api/scrape/run
SCRAPE_ENABLED_SOURCES=vivareal,zap,quintoandar  # add as each scraper is implemented
SCRAPE_RATE_LIMIT_MS=2000

# Database
DB_PATH=./data/listings.db  # Override to /app/data/listings.db on Fly.io

# Notifications
RESEND_API_KEY=
EMAIL_TO=you@email.com
EMAIL_FROM=alerts@yourdomain.com

# App
NEXT_PUBLIC_APP_NAME=Apartment Hunter POA
TIMEZONE=America/Sao_Paulo
PORT=3000
```

---

## Key Files Reference

```
src/
  app/
    page.tsx                      — home: new listings today, ranked
    all/page.tsx                  — all listings table (with removed toggle)
    listing/[id]/page.tsx         — detail: price history, sources, AI rationale, retain/delete
    profile/page.tsx              — configure search filters
    runs/page.tsx                 — scraper execution history
    api/
      scrape/run/route.ts         — POST: trigger full scrape + rank + notify pipeline
      scrape/run/[id]/route.ts    — GET: poll scrape run status
      rank/run/route.ts           — POST: manually re-rank all active listings
      profile/route.ts            — GET/POST: fetch or save active filter profile
      listings/[id]/route.ts      — PATCH: update interest_level, status (archive/delete)
  scrapers/
    _base.ts                      — base class: rate limiting, robots.txt, retries
    vivareal.ts                   — VivaReal portal scraper (done)
    zap.ts                        — ZAP Imóveis scraper (next — same OLX Group API)
    quintoandar.ts                — QuintoAndar sales scraper (planned — GraphQL API)
  ranking/
    index.ts                      — orchestrates ranking pass, selects AIProvider
    deterministic.ts              — hard filter + 0-60pt deterministic score
    llm.ts                        — calls AIProvider, 0-40pt qualitative score
    ai-provider.ts                — AIProvider interface + AIScore types
    providers/
      claude.ts                   — Anthropic SDK implementation (default)
      claude-cli.ts               — claude -p subprocess implementation (demo)
      openai.ts                   — OpenAI implementation (future)
  notifications/
    notifier.ts                   — Notifier interface
    email.ts                      — Resend email implementation
  lib/
    ingest.ts                     — normalize, dedupe, upsert pipeline
    neighborhoods.ts              — 85 Porto Alegre neighborhoods
  db/
    client.ts                     — SQLite singleton + migration runner
    migrations/
      001_initial.sql             — base schema
      002_interest_level.sql      — adds interest_level to listings (planned)
    queries/listings.ts           — all DB query functions
  types/index.ts                  — shared TypeScript types
scripts/
  migrate.ts                      — standalone migration runner
.github/
  workflows/
    daily-scrape.yml              — GitHub Actions cron: 7am BRT trigger
fly.toml                          — Fly.io config with persistent volume
data/
  listings.db                     — SQLite database (mounted volume in prod)
  raw/                            — raw scraped JSON per run (gitignored)
```
