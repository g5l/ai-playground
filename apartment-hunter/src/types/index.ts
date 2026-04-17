/**
 * Shared TypeScript types for Apartment Hunter POA.
 */

// ---------------------------------------------------------------------------
// Filter Profile
// ---------------------------------------------------------------------------

export interface FilterCriteria {
  priceMin: number;
  priceMax: number;
  condoFeeMax: number;
  iptuMax: number;
  totalMonthlyMax: number;
  areaMin: number;
  bedroomsMin: number;
  suitesMin: number;
  parkingMin: number;
  neighborhoods: string[];
  petsAllowed: boolean;
  excludeKeywords: string[];
}

export interface FilterProfile {
  id: number;
  name: string;
  filters: FilterCriteria;
  created_at: string;
  updated_at: string;
  is_active: 0 | 1;
}

// Row as returned from SQLite (filters stored as JSON string)
export interface FilterProfileRow {
  id: number;
  name: string;
  filters: string; // JSON string
  created_at: string;
  updated_at: string;
  is_active: number;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export interface Listing {
  id: string; // UUID
  dedupe_key: string;
  title: string;
  price: number;
  condo_fee: number;
  iptu: number;
  area: number;
  bedrooms: number;
  suites: number;
  parking: number;
  neighborhood: string;
  city: string;
  address: string;
  description: string;
  pets_allowed: 0 | 1 | null;
  latitude: number | null;
  longitude: number | null;
  first_seen_at: string;
  last_seen_at: string;
  last_checked_at: string;
  status: "active" | "inactive" | "removed";
}

// Raw scraped data before normalisation
export interface RawListing {
  source: string;
  external_id: string;
  url: string;
  title?: string;
  price?: number;
  condo_fee?: number;
  iptu?: number;
  area?: number;
  bedrooms?: number;
  suites?: number;
  parking?: number;
  neighborhood?: string;
  city?: string;
  address?: string;
  description?: string;
  pets_allowed?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  raw_payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Scrape Runs
// ---------------------------------------------------------------------------

export interface ScrapeRun {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  listings_found: number;
  listings_new: number;
  listings_updated: number;
  errors: string[]; // parsed from JSON
  status: "running" | "success" | "error";
}

// ---------------------------------------------------------------------------
// Listing Sources & Snapshots
// ---------------------------------------------------------------------------

export interface ListingSource {
  listing_id: string;
  source: string;
  external_id: string;
  url: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ListingSnapshot {
  id?: number;
  listing_id: string;
  captured_at: string;
  price: number;
  condo_fee: number;
  raw_payload: string; // JSON string
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export interface Ranking {
  listing_id: string;
  profile_id: number;
  score: number;
  rationale: string;
  ranked_at: string;
}
