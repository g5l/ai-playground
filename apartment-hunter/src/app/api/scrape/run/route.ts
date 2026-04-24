/**
 * POST /api/scrape/run
 * Triggers a scrape run using enabled scrapers and the active filter profile.
 */

import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { getDb } from "@/db/client";
import type { FilterProfileRow, FilterCriteria } from "@/types/index";
import { VivaRealScraper } from "@/scrapers/vivareal";
import { processScraperResults } from "@/lib/ingest";
import {
  startScrapeRun,
  finishScrapeRun,
} from "@/db/queries/listings";
import { runRankingPass } from "@/ranking/index";

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const scrapeKey = process.env.SCRAPE_API_KEY;
  if (!scrapeKey) return true; // No key configured → open (local-only)

  const provided = req.headers.get("x-scrape-key");
  return provided === scrapeKey;
}

// ---------------------------------------------------------------------------
// Load active FilterProfile from DB
// ---------------------------------------------------------------------------

interface ActiveProfile {
  id: number;
  filters: FilterCriteria;
}

function loadActiveProfile(): ActiveProfile | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM filter_profiles WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
    )
    .get() as FilterProfileRow | undefined;

  if (!row) return null;

  try {
    return { id: row.id, filters: JSON.parse(row.filters) as FilterCriteria };
  } catch {
    logger.error({ filters: row.filters }, "scrape/run: failed to parse filter profile");
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = loadActiveProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "No active filter profile found in DB" },
      { status: 400 }
    );
  }

  const { id: profileId, filters } = profile;

  const enabledSources = (
    process.env.SCRAPE_ENABLED_SOURCES ?? "vivareal"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!enabledSources.includes("vivareal")) {
    return NextResponse.json(
      {
        success: false,
        error: "vivareal not in SCRAPE_ENABLED_SOURCES",
      },
      { status: 400 }
    );
  }

  const scraper = new VivaRealScraper();
  const runId = startScrapeRun(scraper.source);
  logger.info({ runId, source: scraper.source }, "scrape/run: started");

  let stats: { found: number; new: number; updated: number; errors: string[] };
  let runStatus: "success" | "error" = "success";

  try {
    stats = await processScraperResults(
      scraper.source,
      scraper.search(filters)
    );

    if (stats.errors.length > 0) {
      runStatus = "error";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, runId }, "scrape/run: fatal error");
    stats = { found: 0, new: 0, updated: 0, errors: [msg] };
    runStatus = "error";
  }

  finishScrapeRun(runId, { ...stats, status: runStatus });
  logger.info({ runId, stats, status: runStatus }, "scrape/run: finished");

  // Run ranking pass — errors must not affect the scrape response
  try {
    const rankingResult = await runRankingPass(profileId, filters);
    logger.info({ rankingResult }, "scrape/run: ranking complete");
  } catch (rankErr) {
    logger.error({ rankErr }, "scrape/run: ranking pass failed (non-fatal)");
  }

  return NextResponse.json({ success: true, stats });
}
