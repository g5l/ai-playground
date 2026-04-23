/**
 * DB query functions for listings, sources, snapshots and scrape runs.
 */

import { getDb } from "@/db/client";
import type { Listing, ListingSource, ListingSnapshot, ScrapeRun, Ranking } from "@/types/index";

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export function upsertListing(listing: Listing): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO listings (
      id, dedupe_key, title, price, condo_fee, iptu, area,
      bedrooms, suites, parking, neighborhood, city, address,
      description, pets_allowed, latitude, longitude,
      first_seen_at, last_seen_at, last_checked_at, status
    ) VALUES (
      @id, @dedupe_key, @title, @price, @condo_fee, @iptu, @area,
      @bedrooms, @suites, @parking, @neighborhood, @city, @address,
      @description, @pets_allowed, @latitude, @longitude,
      @first_seen_at, @last_seen_at, @last_checked_at, @status
    )
  `).run({
    ...listing,
    pets_allowed: listing.pets_allowed ?? null,
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
  });
}

export function getAllListings(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Listing[] {
  const db = getDb();
  const status = opts?.status ?? "active";
  const limit = opts?.limit ?? 500;
  const offset = opts?.offset ?? 0;

  return db
    .prepare(
      `SELECT * FROM listings WHERE status = ? ORDER BY last_seen_at DESC LIMIT ? OFFSET ?`
    )
    .all(status, limit, offset) as Listing[];
}

export function getListingById(id: string): Listing | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM listings WHERE id = ?`)
    .get(id) as Listing | undefined;
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Listing Sources
// ---------------------------------------------------------------------------

export function upsertListingSource(source: ListingSource): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO listing_sources (listing_id, source, external_id, url, first_seen_at, last_seen_at)
    VALUES (@listing_id, @source, @external_id, @url, @first_seen_at, @last_seen_at)
    ON CONFLICT (listing_id, source) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      url          = excluded.url
  `).run(source);
}

// ---------------------------------------------------------------------------
// Listing Snapshots
// ---------------------------------------------------------------------------

export function insertSnapshot(
  snapshot: Omit<ListingSnapshot, "id">
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO listing_snapshots (listing_id, captured_at, price, condo_fee, raw_payload)
    VALUES (@listing_id, @captured_at, @price, @condo_fee, @raw_payload)
  `).run(snapshot);
}

// ---------------------------------------------------------------------------
// Scrape Runs
// ---------------------------------------------------------------------------

export function startScrapeRun(source: string): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO scrape_runs (source, started_at, status) VALUES (?, datetime('now'), 'running')`
    )
    .run(source);
  return result.lastInsertRowid as number;
}

export function finishScrapeRun(
  id: number,
  stats: {
    found: number;
    new: number;
    updated: number;
    errors: string[];
    status: "success" | "error";
  }
): void {
  const db = getDb();
  db.prepare(`
    UPDATE scrape_runs SET
      finished_at      = datetime('now'),
      listings_found   = @found,
      listings_new     = @new,
      listings_updated = @updated,
      errors           = @errors,
      status           = @status
    WHERE id = @id
  `).run({
    id,
    found: stats.found,
    new: stats.new,
    updated: stats.updated,
    errors: JSON.stringify(stats.errors),
    status: stats.status,
  });
}

export function appendScrapeRunError(id: number, error: string): void {
  const db = getDb();
  // Read current errors, append, write back
  const row = db
    .prepare(`SELECT errors FROM scrape_runs WHERE id = ?`)
    .get(id) as { errors: string } | undefined;
  if (!row) return;

  let errors: string[] = [];
  try {
    errors = JSON.parse(row.errors) as string[];
  } catch {
    errors = [];
  }
  errors.push(error);

  db.prepare(`UPDATE scrape_runs SET errors = ? WHERE id = ?`).run(
    JSON.stringify(errors),
    id
  );
}

// Raw row type from SQLite (errors stored as JSON string)
interface ScrapeRunRow {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  listings_found: number;
  listings_new: number;
  listings_updated: number;
  errors: string;
  status: "running" | "success" | "error";
}

function parseRunRow(row: ScrapeRunRow): ScrapeRun {
  let errors: string[] = [];
  try {
    errors = JSON.parse(row.errors) as string[];
  } catch {
    errors = [];
  }
  return { ...row, errors };
}

export function getScrapeRuns(limit = 50): ScrapeRun[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT ?`
    )
    .all(limit) as ScrapeRunRow[];
  return rows.map(parseRunRow);
}

export function getScrapeRunById(id: number): ScrapeRun | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM scrape_runs WHERE id = ?`)
    .get(id) as ScrapeRunRow | undefined;
  return row ? parseRunRow(row) : null;
}

export function getListingSnapshots(listingId: string): ListingSnapshot[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM listing_snapshots WHERE listing_id = ? ORDER BY captured_at ASC`
    )
    .all(listingId) as ListingSnapshot[];
}

export function getListingSources(listingId: string): ListingSource[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM listing_sources WHERE listing_id = ?`
    )
    .all(listingId) as ListingSource[];
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export function upsertRanking(ranking: Ranking): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO rankings (listing_id, profile_id, score, rationale, ranked_at)
    VALUES (@listing_id, @profile_id, @score, @rationale, @ranked_at)
    ON CONFLICT (listing_id, profile_id) DO UPDATE SET
      score      = excluded.score,
      rationale  = excluded.rationale,
      ranked_at  = excluded.ranked_at
  `).run(ranking);
}

// ---------------------------------------------------------------------------
// New listings today (with ranking join)
// ---------------------------------------------------------------------------

export function getNewListingsToday(): Array<
  Listing & { score: number | null; rationale: string | null }
> {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        l.*,
        r.score,
        r.rationale
      FROM listings l
      LEFT JOIN rankings r ON r.listing_id = l.id
        AND r.profile_id = (
          SELECT id FROM filter_profiles WHERE is_active = 1 ORDER BY id DESC LIMIT 1
        )
      WHERE date(l.first_seen_at) = date('now')
        AND l.status = 'active'
      ORDER BY COALESCE(r.score, 0) DESC, l.first_seen_at DESC
      `
    )
    .all() as Array<Listing & { score: number | null; rationale: string | null }>;
}
