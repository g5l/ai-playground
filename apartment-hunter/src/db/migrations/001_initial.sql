-- Migration 001: Initial schema

-- Filter profiles for search criteria
CREATE TABLE IF NOT EXISTS filter_profiles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL DEFAULT 'Default',
  filters    TEXT    NOT NULL DEFAULT '{}', -- JSON
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  is_active  INTEGER NOT NULL DEFAULT 0
);

-- Core listings table
CREATE TABLE IF NOT EXISTS listings (
  id             TEXT    PRIMARY KEY,         -- UUID
  dedupe_key     TEXT    NOT NULL UNIQUE,     -- e.g. source:external_id
  title          TEXT    NOT NULL DEFAULT '',
  price          REAL    NOT NULL DEFAULT 0,
  condo_fee      REAL    NOT NULL DEFAULT 0,
  iptu           REAL    NOT NULL DEFAULT 0,
  area           REAL    NOT NULL DEFAULT 0,
  bedrooms       INTEGER NOT NULL DEFAULT 0,
  suites         INTEGER NOT NULL DEFAULT 0,
  parking        INTEGER NOT NULL DEFAULT 0,
  neighborhood   TEXT    NOT NULL DEFAULT '',
  city           TEXT    NOT NULL DEFAULT '',
  address        TEXT    NOT NULL DEFAULT '',
  description    TEXT    NOT NULL DEFAULT '',
  pets_allowed   INTEGER,                     -- NULL = unknown, 0 = no, 1 = yes
  latitude       REAL,
  longitude      REAL,
  first_seen_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  last_checked_at TEXT   NOT NULL DEFAULT (datetime('now')),
  status         TEXT    NOT NULL DEFAULT 'active'
);

-- Sources for each listing (a listing can appear on multiple portals)
CREATE TABLE IF NOT EXISTS listing_sources (
  listing_id   TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  source       TEXT NOT NULL, -- e.g. 'vivareal', 'zap'
  external_id  TEXT NOT NULL,
  url          TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (listing_id, source)
);

-- Price/detail snapshots over time
CREATE TABLE IF NOT EXISTS listing_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id   TEXT    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  captured_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  price        REAL    NOT NULL DEFAULT 0,
  condo_fee    REAL    NOT NULL DEFAULT 0,
  raw_payload  TEXT    NOT NULL DEFAULT '{}' -- JSON
);

-- Scraper run logs
CREATE TABLE IF NOT EXISTS scrape_runs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source           TEXT    NOT NULL,
  started_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  finished_at      TEXT,
  listings_found   INTEGER NOT NULL DEFAULT 0,
  listings_new     INTEGER NOT NULL DEFAULT 0,
  listings_updated INTEGER NOT NULL DEFAULT 0,
  errors           TEXT    NOT NULL DEFAULT '[]', -- JSON array of error strings
  status           TEXT    NOT NULL DEFAULT 'running' -- 'running' | 'success' | 'error'
);

-- AI rankings per profile
CREATE TABLE IF NOT EXISTS rankings (
  listing_id TEXT    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES filter_profiles(id) ON DELETE CASCADE,
  score      REAL    NOT NULL DEFAULT 0,
  rationale  TEXT    NOT NULL DEFAULT '',
  ranked_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (listing_id, profile_id)
);

-- Seed default filter profile
INSERT OR IGNORE INTO filter_profiles (id, name, filters, is_active)
VALUES (
  1,
  'Meu Perfil',
  json('{
    "priceMin": 300000,
    "priceMax": 900000,
    "condoFeeMax": 1500,
    "iptuMax": 500,
    "totalMonthlyMax": 10000,
    "areaMin": 60,
    "bedroomsMin": 2,
    "suitesMin": 1,
    "parkingMin": 1,
    "neighborhoods": [],
    "petsAllowed": false,
    "excludeKeywords": []
  }'),
  1
);
