/**
 * Deterministic scoring and hard-filtering for apartment listings.
 */

import type { Listing, FilterCriteria } from "@/types/index";

// ---------------------------------------------------------------------------
// Hard filter
// ---------------------------------------------------------------------------

export function filterListing(
  listing: Listing,
  filters: FilterCriteria
): { pass: boolean; reason?: string } {
  const { price, condo_fee, area, bedrooms, pets_allowed, title, description } =
    listing;

  // Price bounds
  if (filters.priceMin > 0 && price < filters.priceMin) {
    return { pass: false, reason: `Price ${price} below priceMin ${filters.priceMin}` };
  }
  if (filters.priceMax > 0 && price > filters.priceMax) {
    return { pass: false, reason: `Price ${price} above priceMax ${filters.priceMax}` };
  }

  // Condo fee
  if (filters.condoFeeMax > 0 && condo_fee > 0 && condo_fee > filters.condoFeeMax) {
    return {
      pass: false,
      reason: `Condo fee ${condo_fee} above condoFeeMax ${filters.condoFeeMax}`,
    };
  }

  // Area
  if (filters.areaMin > 0 && area > 0 && area < filters.areaMin) {
    return { pass: false, reason: `Area ${area} below areaMin ${filters.areaMin}` };
  }

  // Bedrooms
  if (filters.bedroomsMin > 0 && bedrooms > 0 && bedrooms < filters.bedroomsMin) {
    return {
      pass: false,
      reason: `Bedrooms ${bedrooms} below bedroomsMin ${filters.bedroomsMin}`,
    };
  }

  // Exclude keywords
  if (filters.excludeKeywords.length > 0) {
    const haystack = `${title} ${description}`.toLowerCase();
    for (const kw of filters.excludeKeywords) {
      if (haystack.includes(kw.toLowerCase())) {
        return { pass: false, reason: `Excluded keyword: "${kw}"` };
      }
    }
  }

  // Pets
  if (filters.petsAllowed === true && pets_allowed === 0) {
    return { pass: false, reason: "Pets explicitly forbidden" };
  }

  return { pass: true };
}

// ---------------------------------------------------------------------------
// Deterministic scoring (0-60 points)
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function scoreListingDeterministic(
  listing: Listing,
  filters: FilterCriteria
): number {
  let total = 0;

  // --- Price fit (0-20 pts) ---
  {
    const { price } = listing;
    const { priceMin, priceMax } = filters;
    let pts: number;
    if (priceMax <= priceMin) {
      pts = price <= priceMin ? 20 : 0;
    } else {
      pts = 20 * (1 - (price - priceMin) / (priceMax - priceMin));
    }
    total += clamp(pts, 0, 20);
  }

  // --- Area fit (0-15 pts) ---
  {
    const { area } = listing;
    const { areaMin } = filters;
    let pts: number;
    if (areaMin <= 0) {
      pts = 15; // no preference
    } else if (area < areaMin) {
      pts = 0;
    } else if (area >= areaMin * 1.5) {
      pts = 15;
    } else {
      pts = 15 * ((area - areaMin) / (areaMin * 0.5));
    }
    total += clamp(pts, 0, 15);
  }

  // --- Bedrooms fit (0-10 pts) ---
  {
    const { bedrooms } = listing;
    const { bedroomsMin } = filters;
    let pts: number;
    if (bedroomsMin <= 0) {
      pts = 10;
    } else if (bedrooms >= bedroomsMin + 1) {
      pts = 10;
    } else if (bedrooms === bedroomsMin) {
      pts = 8;
    } else {
      pts = 0;
    }
    total += pts;
  }

  // --- Condo fee (0-10 pts) ---
  {
    const { condo_fee } = listing;
    const { condoFeeMax } = filters;
    let pts: number;
    if (condo_fee === 0) {
      pts = 10;
    } else if (condoFeeMax <= 0) {
      pts = 5; // no limit set, neutral
    } else {
      pts = 10 * (1 - condo_fee / condoFeeMax);
    }
    total += clamp(pts, 0, 10);
  }

  // --- Neighborhood preference (0-5 pts) ---
  {
    const { neighborhoods } = filters;
    if (neighborhoods.length === 0) {
      total += 2; // no preference → neutral bonus
    } else {
      const listingNeighborhood = listing.neighborhood.toLowerCase();
      const matched = neighborhoods.some(
        (n) => n.toLowerCase() === listingNeighborhood
      );
      total += matched ? 5 : 0;
    }
  }

  return clamp(total, 0, 60);
}
