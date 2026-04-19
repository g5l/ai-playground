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
  const dedupeKey = `${raw.source}:${raw.external_id}`;

  const existing = getExistingByDedupeKey(dedupeKey);
  const isNew = existing === null;

  const listing: Listing = {
    id: existing?.id ?? uuidv4(),
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
    first_seen_at: existing?.first_seen_at ?? now,
    last_seen_at: now,
    last_checked_at: now,
    status: "active",
  };

  upsertListing(listing);

  const source: ListingSource = {
    listing_id: listing.id,
    source: raw.source,
    external_id: raw.external_id,
    url: raw.url,
    first_seen_at: existing?.first_seen_at ?? now,
    last_seen_at: now,
  };

  upsertListingSource(source);

  const snapshot: Omit<ListingSnapshot, "id"> = {
    listing_id: listing.id,
    captured_at: now,
    price: listing.price,
    condo_fee: listing.condo_fee,
    raw_payload: JSON.stringify(raw.raw_payload),
  };

  insertSnapshot(snapshot);

  return { isNew };
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
