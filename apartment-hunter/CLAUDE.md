# Apartment Hunter POA — Architecture & Project Plan

## Project Goal

A personal, automated apartment hunting tool for Porto Alegre, Brazil. It scrapes real estate portals daily, deduplicates and normalizes listings, ranks them against personal search criteria using deterministic rules and AI qualitative scoring, and delivers the best options to the user without manual effort.

**The outcome:** Every morning, a ranked, curated list of new apartments arrives on your phone or email. No browsing portals. No manual filtering.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14 (App Router) | Full-stack: API routes + UI in one repo |
| UI | Mantine v7 + Tabler Icons | Fast to build, dark mode, responsive |
| Database | SQLite (better-sqlite3, WAL mode) | Zero-ops, cheap, sufficient for personal use |
| AI Ranking | Anthropic Claude API | Portuguese text analysis, qualitative scoring |
| Logging | pino + pino-pretty | Structured logs for debugging scrape runs |
| Runtime | Node.js (TypeScript) | Consistent across scrapers, API, and scripts |

**Note on "AI API":** The project uses the **Anthropic/Claude API** (not OpenAI). Claude is preferred because it is already integrated, handles Portuguese text well, and the qualitative scoring prompt is already tuned for property descriptions. Migrating to OpenAI is possible but not recommended unless cost or capability becomes an issue.

---

## Full Pipeline: Start to Finish

```
[Cron: 7am BRT daily]
        │
        ▼
POST /api/scrape/run
        │
        ├── VivaReal Scraper    (implemented)
        ├── ZAP Imóveis Scraper (planned — next priority)
        └── OLX Imóveis Scraper (planned — future)
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
  Stage 1 — Hard Filter   (eliminates outside criteria: price, area, beds, condo fee)
  Stage 2 — Deterministic (0–60pts: price fit, area, bedrooms, condo fee, neighborhood)
  Stage 3 — LLM Score     (0–40pts: Claude reads top 30 listings, scores qualitative factors)
        │
        ▼
Notifications (planned)
  - Telegram Bot: top 5 new listings with score + AI rationale
  - Email (Resend): daily digest of full ranked list
        │
        ▼
Next.js UI (running on Railway)
  /           — new listings today, ranked
  /all        — full table of all active listings
  /listing/id — detail view: price history, sources, AI rationale
  /profile    — configure search filters
  /runs       — scraper execution history
```

---

## Database Schema (SQLite)

### filter_profiles
Stores the user's search criteria. One is marked `is_active = true` at a time.
- `filters` JSON: priceMin, priceMax, areaMin, bedroomsMin, condoFeeMax, neighborhoods[], excludedKeywords[], petsAllowed

### listings
Core table. One row per unique physical apartment (deduplicated across portals).
- UUID primary key, dedupe_key (UNIQUE), all normalized fields
- `status`: active | inactive | removed
- `first_seen_at`, `last_seen_at`, `last_checked_at`

### listing_sources
Tracks which portals each listing appears on. Composite PK `(listing_id, source)`.
- Stores `external_id`, `url`, `first_seen_at`, `last_seen_at` per source

### listing_snapshots
Price history. One row per scrape per listing.
- Allows detecting price drops and relisting events
- `raw_payload` JSON stores the full scraped response for debugging

### scrape_runs
Execution log per scraper invocation.
- `status`: running | success | error
- `listings_found`, `listings_new`, `listings_updated`, `errors` JSON

### rankings
AI + deterministic scores per listing per profile. Composite PK `(listing_id, profile_id)`.
- `score` (0–100), `rationale` (Portuguese text from Claude), `ranked_at`

---

## Scraper Architecture

### Goal
Find every apartment for sale in Porto Alegre that meets the base price/area criteria, across all major real estate portals, before the user wakes up.

### Base Scraper (src/scrapers/_base.ts)
All scrapers extend `BaseScraper`:
- `robots.txt` check and caching per host
- Rate limiting: 2000ms ± 20% jitter between requests
- Exponential backoff on HTTP 429 / 503
- Raw response storage in `data/raw/<source>/`
- Abstract method `scrape(profile)` returns normalized `RawListing[]`

### VivaReal Scraper (src/scrapers/vivareal.ts) — DONE
- Hits `https://glue-api.vivareal.com.br/v2/listings`
- Paginated JSON API: 36 items per page, up to 1000 listings
- Filters by price range on the API side to reduce irrelevant results
- Porto Alegre, RS — APARTMENT — SALE

### ZAP Imóveis Scraper (src/scrapers/zap.ts) — NEXT
- Same OLX Group as VivaReal, very similar API structure
- Endpoint: `https://glue-api.zapimoveis.com.br/v2/listings`
- Same pagination pattern, same field mapping
- Highest priority: same effort as VivaReal, doubles coverage

### OLX Imóveis Scraper — FUTURE
- Different API, lower priority
- More general marketplace, lower listing quality

### Deduplication Strategy (src/lib/ingest.ts)
When the same physical apartment appears on multiple portals:
1. Normalize address (lowercase, remove accents and punctuation)
2. Bucket area to nearest 2 m²
3. Bucket price to nearest R$10k
4. Dedupe key: `{normalized_address}|{area_bucket}|{price_bucket}`
5. Fallback key: `{source}:{external_id}` (if address is missing)
6. On collision: merge sources into `listing_sources`, update snapshot

---

## AI Ranking: Role of Claude

### Current Behavior (src/ranking/llm.ts)
1. The deterministic stage produces a scored, filtered list
2. Top 30 deterministic scorers are sent to Claude in a single batch prompt
3. Claude receives: title, description, price, area, neighborhood, condo fee, bedrooms
4. Claude returns JSON: `{ listings: [{ id, score: 0–40, rationale: string }] }`
5. Rationale is stored in Portuguese and displayed in the UI

### What Claude Evaluates (0–40pts)
- Finishing quality signals in the description (piso porcelanato, cozinha americana, etc.)
- Sun orientation mentions (sol da manhã, frente norte, etc.)
- Building age and renovation status
- Amenities (academia, piscina, portaria 24h, salão de festas)
- Description credibility and completeness (penalizes vague/lazy listings)
- Price vs. apparent quality signal

### Planned Improvements

**User Feedback Loop (high priority)**
- Add `interest_level` column to listings: thumbs_up | thumbs_down | null
- Include 5–10 user-rated examples in the Claude prompt as few-shot examples
- "The user has rated these positively: [...]. The user has rated these negatively: [...]."
- Makes ranking personalize over time without retraining

**Price Signal Injection**
- Pass price history to Claude: "This listing dropped R$50k in 60 days."
- Claude can factor urgency vs. red flag into its rationale

**Neighborhood Context**
- Add freetext neighborhood notes to filter profile: "Moinhos de Vento: quiet, walkable, prefer streets near Parcão"
- Include in Claude prompt for richer neighborhood scoring

---

## Cloud Deployment

### Recommended: Railway (~$5/month)
Railway supports persistent volumes (required for SQLite), Git-based deploys, and native cron jobs.

**Setup:**
1. Connect GitHub repo to Railway project
2. Attach a persistent volume at `/app/data` (for `listings.db`)
3. Set environment variables: `ANTHROPIC_API_KEY`, `SCRAPE_API_KEY`, etc.
4. Add a Railway cron service:
   ```
   0 10 * * *   curl -s -X POST http://localhost:3000/api/scrape/run \
                  -H "X-API-Key: $SCRAPE_API_KEY"
   ```
   (10:00 UTC = 07:00 BRT)

**Cost breakdown:**
- Starter plan: ~$5/month
- Anthropic API (Claude ranking): ~$0.10–0.50/day depending on listing volume
- Total: under $10/month

### Alternative: Fly.io + GitHub Actions (~$0–3/month)
- Fly.io hosts the Next.js app with a persistent volume
- GitHub Actions free cron triggers the scrape endpoint daily
- Slightly more complex to set up but cheaper

### Not Recommended
- Vercel / Netlify: serverless, no persistent volumes, SQLite won't work
- AWS Lambda: same problem plus cold starts break long-running scrapes

---

## Notifications (Planned)

### Telegram Bot (recommended first)
- Free, instant, works great on mobile
- Rich messages: title, price, area, score, rationale, link to portal
- Implementation: after ranking, `POST https://api.telegram.org/bot<token>/sendMessage`
- Trigger: only when `listings_new > 0` and `top_score >= threshold`

### Email Digest via Resend (secondary)
- Free tier: 3,000 emails/month
- Daily HTML digest with top 10 ranked listings
- Include price change indicators for listings seen before

---

## What to Build Next (Priority Order)

1. **Deploy to Railway** — get the daily cron running in the cloud unattended
2. **Telegram notifications** — new listings reach your phone automatically each morning
3. **ZAP Imóveis scraper** — doubles listing coverage, low implementation effort
4. **Wire price drop detection** — `isPriceDrop` is in `ListingCard` but hardcoded false; connect snapshot comparison logic
5. **User feedback (thumbs up/down)** — feeds back into Claude ranking over time
6. **Resend email digest** — secondary daily summary

---

## Open Questions (Decisions Needed)

- **Notification channel:** Telegram, email, or both?
- **Cloud budget:** ~$5/month on Railway, or fully-free Fly.io + GitHub Actions?
- **Search scope:** Porto Alegre only, or specific neighborhoods as primary filter?
- **AI provider:** Keep Claude (already integrated), or switch to OpenAI?
- **Data retention:** Keep removed listings forever, or purge after N weeks?
- **Multi-profile:** Solo use, or would a partner/roommate use it with different criteria?

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=          # Claude API key for ranking
SCRAPE_API_KEY=             # Optional auth header for scrape endpoints
SCRAPE_ENABLED_SOURCES=vivareal,zap
SCRAPE_RATE_LIMIT_MS=2000
DB_PATH=./data/listings.db
NEXT_PUBLIC_APP_NAME=Apartment Hunter POA
TIMEZONE=America/Sao_Paulo
TELEGRAM_BOT_TOKEN=         # Planned: for notifications
TELEGRAM_CHAT_ID=           # Planned: your personal chat ID
RESEND_API_KEY=             # Planned: for email digest
```

---

## Key Files Reference

```
src/
  app/
    page.tsx                  — home: new listings today, ranked
    all/page.tsx              — all listings table
    listing/[id]/page.tsx     — listing detail: price history, sources, rationale
    profile/page.tsx          — configure search filters
    runs/page.tsx             — scraper execution history
    api/
      scrape/run/route.ts     — POST: trigger full scrape + ranking pipeline
      scrape/run/[id]/route.ts — GET: poll scrape run status
      rank/run/route.ts       — POST: manually re-rank all listings
      profile/route.ts        — GET/POST: fetch or save active filter profile
  scrapers/
    _base.ts                  — base class: rate limiting, robots.txt, retries
    vivareal.ts               — VivaReal portal scraper (done)
  ranking/
    index.ts                  — orchestrates ranking pass
    deterministic.ts          — hard filter + 0-60pt score
    llm.ts                    — Claude qualitative score 0-40pt
  lib/
    ingest.ts                 — normalize, dedupe, upsert pipeline
    neighborhoods.ts          — 85 Porto Alegre neighborhoods list
  db/
    client.ts                 — SQLite singleton + migration runner
    migrations/001_initial.sql — full schema
    queries/listings.ts       — all DB query functions
  types/index.ts              — shared TypeScript types
scripts/
  migrate.ts                  — standalone migration runner
data/
  listings.db                 — SQLite database (persistent volume in prod)
  raw/                        — raw scraped JSON per run
```
