/**
 * Ingestion pipeline: converts RawListings → Listings and persists to DB.
 */

import { v4 as uuidv4 } from "uuid";
import logger from "@/lib/logger";
import type { RawListing, Listing, ListingSource, ListingSnapshot } from "@/types/index";
import {
  upsertListing,
  upsertListingSource,
  insertSnapshot,
} from "@/db/queries/listings";
import { getDb } from "@/db/client";

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

const ACCENT_MAP: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u",
  ã: "a", õ: "o",
  â: "a", ê: "e", ô: "o",
  ç: "c", ü: "u", à: "a",
};

/**
 * Normalises an address string for cross-source deduplication:
 * - lowercases
 * - replaces common Portuguese accented characters
 * - removes punctuation
 * - collapses and trims whitespace
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[áéíóúãõâêôçüà]/g, (ch) => ACCENT_MAP[ch] ?? ch)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Buckets area to the nearest 2 m² to tolerate rounding differences across sources.
 */
function bucketArea(area: number): number {
  return Math.round(area / 2) * 2;
}

/**
 * Buckets price to the nearest R$10,000 to tolerate small price differences.
 */
function bucketPrice(price: number): number {
  return Math.round(price / 10000) * 10000;
}

/**
 * Builds a heuristic cross-source dedupe key.
 * Falls back to `source:external_id` when address is unknown.
 */
function buildDedupeKey(raw: RawListing): string {
  const normalized = normalizeAddress(raw.address ?? "");
  if (!normalized) {
    return `${raw.source}:${raw.external_id}`;
  }
  const area = bucketArea(raw.area ?? 0);
  const price = bucketPrice(raw.price ?? 0);
  return `${normalized}|${area}|${price}`;
}

function getExistingByDedupeKey(dedupeKey: string): Listing | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM listings WHERE dedupe_key = ?`)
    .get(dedupeKey) as Listing | undefined;
  return row ?? null;
}

// ---------------------------------------------------------------------------
// ingestListing
// ---------------------------------------------------------------------------

export function ingestListing(raw: RawListing): { isNew: boolean } {
  const now = new Date().toISOString();
  const dedupeKey = buildDedupeKey(raw);

  const existing = getExistingByDedupeKey(dedupeKey);

  if (existing !== null) {
    // Cross-source duplicate detected — keep the existing listing record
    logger.info(
      { source: raw.source, existing_source: existing.dedupe_key, dedupeKey },
      "[ingest] duplicate detected: cross-source match"
    );

    // Update last_seen_at on the existing listing
    const updatedListing: Listing = {
      ...existing,
      last_seen_at: now,
      last_checked_at: now,
      status: "active",
    };
    upsertListing(updatedListing);

    // Add/update source entry for this source
    const source: ListingSource = {
      listing_id: existing.id,
      source: raw.source,
      external_id: raw.external_id,
      url: raw.url,
      first_seen_at: now,
      last_seen_at: now,
    };
    upsertListingSource(source);

    // Insert a new snapshot
    const snapshot: Omit<ListingSnapshot, "id"> = {
      listing_id: existing.id,
      captured_at: now,
      price: raw.price ?? 0,
      condo_fee: raw.condo_fee ?? 0,
      raw_payload: JSON.stringify(raw.raw_payload),
    };
    insertSnapshot(snapshot);

    return { isNew: false };
  }

  // Genuinely new listing
  const id = uuidv4();

  const listing: Listing = {
    id,
    dedupe_key: dedupeKey,
    title: raw.title ?? "",
    price: raw.price ?? 0,
    condo_fee: raw.condo_fee ?? 0,
    iptu: raw.iptu ?? 0,
    area: raw.area ?? 0,
    bedrooms: raw.bedrooms ?? 0,
    suites: raw.suites ?? 0,
    parking: raw.parking ?? 0,
    neighborhood: raw.neighborhood ?? "",
    city: raw.city ?? "",
    address: raw.address ?? "",
    description: raw.description ?? "",
    pets_allowed: raw.pets_allowed === true ? 1 : raw.pets_allowed === false ? 0 : null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    first_seen_at: now,
    last_seen_at: now,
    last_checked_at: now,
    status: "active",
  };

  upsertListing(listing);

  const source: ListingSource = {
    listing_id: id,
    source: raw.source,
    external_id: raw.external_id,
    url: raw.url,
    first_seen_at: now,
    last_seen_at: now,
  };
  upsertListingSource(source);

  const snapshot: Omit<ListingSnapshot, "id"> = {
    listing_id: id,
    captured_at: now,
    price: listing.price,
    condo_fee: listing.condo_fee,
    raw_payload: JSON.stringify(raw.raw_payload),
  };
  insertSnapshot(snapshot);

  return { isNew: true };
}

// ---------------------------------------------------------------------------
// processScraperResults
// ---------------------------------------------------------------------------

export async function processScraperResults(
  source: string,
  generator: AsyncGenerator<RawListing>
): Promise<{
  found: number;
  new: number;
  updated: number;
  errors: string[];
}> {
  const stats = {
    found: 0,
    new: 0,
    updated: 0,
    errors: [] as string[],
  };

  for await (const raw of generator) {
    stats.found++;
    try {
      const { isNew } = ingestListing(raw);
      if (isNew) {
        stats.new++;
      } else {
        stats.updated++;
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Unknown error for ${raw.external_id}`;
      logger.error({ err, source, external_id: raw.external_id }, "ingest: error processing listing");
      stats.errors.push(msg);
    }
  }

  return stats;
}
