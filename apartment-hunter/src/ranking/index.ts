/**
 * Orchestrates a full ranking pass: filter → deterministic score → LLM → upsert.
 */

import logger from "@/lib/logger";
import { getAllListings, upsertRanking } from "@/db/queries/listings";
import type { FilterCriteria } from "@/types/index";
import { filterListing, scoreListingDeterministic } from "./deterministic";
import { rankWithClaude } from "./llm";

export async function runRankingPass(
  profileId: number,
  filters: FilterCriteria
): Promise<{ ranked: number; filtered: number }> {
  logger.info({ profileId }, "ranking: starting pass");

  // 1. Load all active listings
  const allListings = getAllListings({ status: "active", limit: 2000 });
  logger.info({ total: allListings.length }, "ranking: loaded listings");

  // 2. Hard filter
  const passing: typeof allListings = [];
  let filteredCount = 0;

  for (const listing of allListings) {
    const { pass, reason } = filterListing(listing, filters);
    if (pass) {
      passing.push(listing);
    } else {
      filteredCount++;
      logger.debug({ id: listing.id, reason }, "ranking: listing filtered out");
    }
  }

  logger.info(
    { passing: passing.length, filtered: filteredCount },
    "ranking: hard filter done"
  );

  // 3. Deterministic scores
  const scored = passing.map((listing) => ({
    listing,
    deterministicScore: scoreListingDeterministic(listing, filters),
  }));

  // 4. Sort DESC, take top 30 for Claude
  scored.sort((a, b) => b.deterministicScore - a.deterministicScore);
  const top30 = scored.slice(0, 30);

  // 5. LLM qualitative scores
  const llmResults = await rankWithClaude(top30, filters);

  // 6. Compute final scores and upsert
  const now = new Date().toISOString();
  let rankedCount = 0;

  for (const { listing, deterministicScore } of scored) {
    const llm = llmResults.get(listing.id);
    const qualitativeScore = llm?.qualitativeScore ?? 0;
    const rationale = llm?.rationale ?? "";
    const finalScore = deterministicScore + qualitativeScore;

    upsertRanking({
      listing_id: listing.id,
      profile_id: profileId,
      score: finalScore,
      rationale,
      ranked_at: now,
    });

    rankedCount++;
  }

  logger.info(
    { ranked: rankedCount, filtered: filteredCount },
    "ranking: pass complete"
  );

  return { ranked: rankedCount, filtered: filteredCount };
}
