/**
 * Integration test for the VivaReal scraper.
 *
 * Does NOT hit the network. `fetch` is stubbed to return fixture data.
 * Validates that the scraper correctly maps the API response to the
 * expected RawListing shape, including edge cases in the fixture.
 *
 * Fixture covers:
 *   abc-001 — full listing, all fields populated
 *   abc-002 — missing suites/parking (empty arrays), null condo_fee/iptu, no coordinates
 *   abc-003 — multiple pricingInfos (RENTAL + SALE) → must pick SALE
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock _base before importing the scraper so rate limiting, robots.txt checks,
// and disk writes are all replaced with instant no-ops.
vi.mock("@/scrapers/_base", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/scrapers/_base")>();
  return {
    ...actual,
    rateLimiter: () => async () => {},    // no delay
    checkRobotsTxt: async () => true,     // always allowed
    saveRawResponse: async () => {},      // no disk writes
  };
});

import { VivaRealScraper } from "@/scrapers/vivareal";
import type { RawListing } from "@/types/index";
import vivarealFixture from "../fixtures/vivareal-response.json";

// ---------------------------------------------------------------------------
// Minimal filter profile — values don't affect the mapping logic being tested
// ---------------------------------------------------------------------------

const MOCK_FILTERS = {
  priceMin: 300_000,
  priceMax: 900_000,
  condoFeeMax: 1_500,
  iptuMax: 10_000,
  totalMonthlyMax: 10_000,
  areaMin: 60,
  bedroomsMin: 2,
  suitesMin: 0,
  parkingMin: 0,
  neighborhoods: [],
  petsAllowed: false,
  excludeKeywords: [],
};

// ---------------------------------------------------------------------------
// Helper: collect all yielded listings from the async generator
// ---------------------------------------------------------------------------

async function collectListings(): Promise<RawListing[]> {
  const scraper = new VivaRealScraper();
  const results: RawListing[] = [];
  for await (const listing of scraper.search(MOCK_FILTERS)) {
    results.push(listing);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VivaRealScraper — integration", () => {
  beforeEach(() => {
    // Stub fetch: first call returns fixture data, subsequent calls return empty
    // listings so the generator stops paginating.
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => vivarealFixture,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            ...vivarealFixture,
            search: {
              ...vivarealFixture.search,
              result: { listings: [] },
            },
          }),
        })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --- Volume ---

  it("yields one RawListing per item in the API response", async () => {
    const results = await collectListings();
    expect(results).toHaveLength(3);
  });

  it("preserves fixture order via external_id", async () => {
    const results = await collectListings();
    expect(results.map((r) => r.external_id)).toEqual([
      "abc-001",
      "abc-002",
      "abc-003",
    ]);
  });

  // --- Required identity fields ---

  it('sets source to "vivareal" on every listing', async () => {
    const results = await collectListings();
    for (const listing of results) {
      expect(listing.source).toBe("vivareal");
    }
  });

  it("every listing has a non-empty external_id", async () => {
    const results = await collectListings();
    for (const listing of results) {
      expect(typeof listing.external_id).toBe("string");
      expect(listing.external_id.length).toBeGreaterThan(0);
    }
  });

  it("every listing url is a string starting with https://", async () => {
    const results = await collectListings();
    for (const listing of results) {
      expect(listing.url).toMatch(/^https:\/\//);
    }
  });

  // --- Numeric fields ---

  it("all numeric fields are finite non-negative numbers", async () => {
    const numericFields = [
      "price",
      "condo_fee",
      "iptu",
      "area",
      "bedrooms",
      "suites",
      "parking",
    ] as const;

    const results = await collectListings();
    for (const listing of results) {
      for (const field of numericFields) {
        const val = listing[field];
        expect(typeof val, `${field} must be a number`).toBe("number");
        expect(Number.isFinite(val), `${field} must be finite (not NaN/Infinity)`).toBe(true);
        expect(val, `${field} must be >= 0`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // --- String fields ---

  it("all required string fields are non-null strings", async () => {
    const results = await collectListings();
    for (const listing of results) {
      expect(typeof listing.title).toBe("string");
      expect(typeof listing.neighborhood).toBe("string");
      expect(typeof listing.city).toBe("string");
      expect(typeof listing.address).toBe("string");
      expect(typeof listing.description).toBe("string");
    }
  });

  it("description is never longer than 2000 characters", async () => {
    const results = await collectListings();
    for (const listing of results) {
      expect(listing.description!.length).toBeLessThanOrEqual(2000);
    }
  });

  // --- Coordinates ---

  it("latitude and longitude are number or null — never undefined", async () => {
    const results = await collectListings();
    for (const listing of results) {
      expect(
        listing.latitude === null || typeof listing.latitude === "number",
        "latitude must be number | null"
      ).toBe(true);
      expect(
        listing.longitude === null || typeof listing.longitude === "number",
        "longitude must be number | null"
      ).toBe(true);
    }
  });

  // --- raw_payload ---

  it("raw_payload is a non-null object", async () => {
    const results = await collectListings();
    for (const listing of results) {
      expect(typeof listing.raw_payload).toBe("object");
      expect(listing.raw_payload).not.toBeNull();
    }
  });

  // --- Edge cases ---

  it("defaults suites and parking to 0 when API returns empty arrays (abc-002)", async () => {
    const results = await collectListings();
    const listing = results.find((r) => r.external_id === "abc-002")!;
    expect(listing.suites).toBe(0);
    expect(listing.parking).toBe(0);
  });

  it("defaults condo_fee and iptu to 0 when API returns null (abc-002)", async () => {
    const results = await collectListings();
    const listing = results.find((r) => r.external_id === "abc-002")!;
    expect(listing.condo_fee).toBe(0);
    expect(listing.iptu).toBe(0);
  });

  it("sets lat/lon to null when API response has no coordinates (abc-002)", async () => {
    const results = await collectListings();
    const listing = results.find((r) => r.external_id === "abc-002")!;
    expect(listing.latitude).toBeNull();
    expect(listing.longitude).toBeNull();
  });

  it("picks SALE price when listing has both RENTAL and SALE pricingInfos (abc-003)", async () => {
    const results = await collectListings();
    const listing = results.find((r) => r.external_id === "abc-003")!;
    // Fixture has RENTAL price=5000, SALE price=890000 — must pick SALE
    expect(listing.price).toBe(890_000);
  });

  it("coordinates are correct numbers when point is present (abc-003)", async () => {
    const results = await collectListings();
    const listing = results.find((r) => r.external_id === "abc-003")!;
    expect(listing.latitude).toBe(-30.041);
    expect(listing.longitude).toBe(-51.211);
  });
});
