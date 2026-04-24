/**
 * POST /api/rank/run
 * Manually triggers a ranking pass for the active filter profile.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import logger from "@/lib/logger";
import type { FilterProfileRow, FilterCriteria } from "@/types/index";
import { runRankingPass } from "@/ranking/index";

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
    logger.error({ filters: row.filters }, "rank/run: failed to parse filter profile");
    return null;
  }
}

export async function POST(): Promise<NextResponse> {
  const profile = loadActiveProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: "No active filter profile found in DB" },
      { status: 400 }
    );
  }

  try {
    const { ranked, filtered } = await runRankingPass(profile.id, profile.filters);
    logger.info({ ranked, filtered }, "rank/run: manual ranking pass complete");
    return NextResponse.json({ success: true, ranked, filtered });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "rank/run: ranking pass failed");
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
