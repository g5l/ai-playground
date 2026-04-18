/**
 * VivaReal scraper — uses VivaReal's public JSON search API.
 */

import { z } from "zod";
import logger from "@/lib/logger";
import type { FilterCriteria, RawListing } from "@/types/index";
import {
  type Scraper,
  USER_AGENT,
  RATE_LIMIT_MS,
  rateLimiter,
  fetchWithRetry,
  checkRobotsTxt,
  saveRawResponse,
} from "./_base";

// ---------------------------------------------------------------------------
// Zod schemas for VivaReal API response
// ---------------------------------------------------------------------------

const VivaRealAddressSchema = z.object({
  city: z.string().default(""),
  neighborhood: z.string().default(""),
  street: z.string().default(""),
  streetNumber: z.string().default(""),
  complement: z.string().optional().default(""),
  point: z
    .object({
      lat: z.number(),
      lon: z.number(),
    })
    .optional()
    .nullable(),
});

const VivaRealPricingInfoSchema = z.object({
  businessType: z.string(),
  price: z.string().optional().nullable(),
  monthlyCondoFee: z.string().optional().nullable(),
  yearlyIptu: z.string().optional().nullable(),
});

const VivaRealListingSchema = z.object({
  id: z.string(),
  title: z.string().default(""),
  description: z.string().optional().nullable(),
  listingType: z.string().optional(),
  address: VivaRealAddressSchema,
  pricingInfos: z.array(VivaRealPricingInfoSchema).default([]),
  usableAreas: z.array(z.number()).default([]),
  bedrooms: z.array(z.number()).default([]),
  suites: z.array(z.number()).default([]),
  parkingSpaces: z.array(z.number()).default([]),
  unitFloor: z.number().optional().nullable(),
  amenities: z.array(z.string()).default([]),
});

const VivaRealMediaSchema = z.object({
  url: z.string(),
});

const VivaRealListingItemSchema = z.object({
  listing: VivaRealListingSchema,
  medias: z.array(VivaRealMediaSchema).default([]),
});

const VivaRealResponseSchema = z.object({
  search: z.object({
    result: z.object({
      listings: z.array(VivaRealListingItemSchema),
    }),
    totalCount: z.number(),
  }),
});

type VivaRealResponse = z.infer<typeof VivaRealResponseSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = "https://glue-api.vivareal.com.br/v2/listings";
const API_HOST = "https://glue-api.vivareal.com.br";
const PAGE_SIZE = 36;
const MAX_FROM = 1000;

const HEADERS: Record<string, string> = {
  "x-domain": "www.vivareal.com.br",
  origin: "https://www.vivareal.com.br",
  referer: "https://www.vivareal.com.br/",
  "User-Agent": USER_AGENT,
  accept: "application/json",
};

// ---------------------------------------------------------------------------
// Helper: parse price string → number
// ---------------------------------------------------------------------------

function parsePriceString(raw: string | null | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// ---------------------------------------------------------------------------
// Helper: build API URL
// ---------------------------------------------------------------------------

function buildApiUrl(
  filters: FilterCriteria,
  from: number
): string {
  const params = new URLSearchParams({
    addressCity: "Porto Alegre",
    addressState: "Rio Grande do Sul",
    addressCountry: "Brasil",
    business: "SALE",
    listingType: "USED,PRIMARY",
    categoryPage: "RESULT",
    size: String(PAGE_SIZE),
    from: String(from),
    unitTypes: "APARTMENT",
  });

  if (filters.priceMin > 0) {
    params.set("priceMin", String(filters.priceMin));
  }
  if (filters.priceMax > 0) {
    params.set("priceMax", String(filters.priceMax));
  }
  if (filters.neighborhoods.length === 1) {
    // API accepts a single neighborhood filter
    params.set("addressNeighborhood", filters.neighborhoods[0]);
  }

  return `${API_BASE}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// VivaReal scraper
// ---------------------------------------------------------------------------

export class VivaRealScraper implements Scraper {
  readonly source = "vivareal";

  private readonly throttle = rateLimiter(RATE_LIMIT_MS);

  async *search(filters: FilterCriteria): AsyncGenerator<RawListing> {
    // Check robots.txt once
    const allowed = await checkRobotsTxt(API_HOST, "/v2/listings");
    if (!allowed) {
      logger.warn(
        { source: this.source },
        "vivareal: robots.txt disallows scraping, aborting"
      );
      return;
    }

    let from = 0;
    let totalCount: number | null = null;

    while (from <= MAX_FROM) {
      // Enforce rate limit
      await this.throttle(API_HOST);

      const url = buildApiUrl(filters, from);
      logger.info({ url, from }, "vivareal: fetching page");

      let data: VivaRealResponse;
      try {
        const response = await fetchWithRetry(url, { headers: HEADERS });
        const json: unknown = await response.json();
        data = VivaRealResponseSchema.parse(json);
      } catch (err) {
        logger.error({ err, url }, "vivareal: failed to fetch/parse page");
        throw err;
      }

      if (totalCount === null) {
        totalCount = data.search.totalCount;
        logger.info({ totalCount }, "vivareal: total listings available");
      }

      const items = data.search.result.listings;
      if (items.length === 0) {
        logger.info({ from }, "vivareal: no more listings, stopping");
        break;
      }

      for (const item of items) {
        const raw = this.mapToRawListing(item);

        // Save raw JSON
        try {
          await saveRawResponse(
            this.source,
            raw.external_id,
            JSON.stringify(item, null, 2),
            "json"
          );
        } catch (err) {
          logger.warn(
            { err, external_id: raw.external_id },
            "vivareal: failed to save raw JSON (non-fatal)"
          );
        }

        yield raw;
      }

      from += PAGE_SIZE;

      // Stop if we've fetched all available listings
      if (totalCount !== null && from >= totalCount) {
        logger.info({ from, totalCount }, "vivareal: fetched all listings");
        break;
      }
    }
  }

  private mapToRawListing(item: z.infer<typeof VivaRealListingItemSchema>): RawListing {
    const l = item.listing;

    const salePricing = l.pricingInfos.find(
      (p) => p.businessType === "SALE"
    ) ?? l.pricingInfos[0];

    const address = [l.address.street, l.address.streetNumber]
      .filter(Boolean)
      .join(", ");

    return {
      source: this.source,
      external_id: l.id,
      url: `https://www.vivareal.com.br/imovel/${l.id}`,
      title: l.title,
      price: parsePriceString(salePricing?.price),
      condo_fee: parsePriceString(salePricing?.monthlyCondoFee),
      iptu: parsePriceString(salePricing?.yearlyIptu),
      area: l.usableAreas[0] ?? 0,
      bedrooms: l.bedrooms[0] ?? 0,
      suites: l.suites[0] ?? 0,
      parking: l.parkingSpaces[0] ?? 0,
      neighborhood: l.address.neighborhood,
      city: l.address.city,
      address,
      description: (l.description ?? "").slice(0, 2000),
      pets_allowed: null,
      latitude: l.address.point?.lat ?? null,
      longitude: l.address.point?.lon ?? null,
      raw_payload: item as unknown as Record<string, unknown>,
    };
  }
}
