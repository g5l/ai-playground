/**
 * LLM-powered qualitative ranking pass using Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import logger from "@/lib/logger";
import type { Listing, FilterCriteria } from "@/types/index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RankingInput {
  listing: Listing;
  deterministicScore: number;
}

interface ClaudeRankingResult {
  qualitativeScore: number;
  rationale: string;
}

// Shape of each item Claude returns
interface ClaudeResponseItem {
  id: unknown;
  score: unknown;
  rationale: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBuyerProfileSummary(filters: FilterCriteria): string {
  const neighborhoods =
    filters.neighborhoods.length > 0
      ? filters.neighborhoods.join(", ")
      : "sem preferência";

  return [
    `Preço: R$ ${filters.priceMin.toLocaleString("pt-BR")} – R$ ${filters.priceMax.toLocaleString("pt-BR")}`,
    `Área mínima: ${filters.areaMin} m²`,
    `Dormitórios mínimos: ${filters.bedroomsMin}`,
    `Taxa de condomínio máxima: R$ ${filters.condoFeeMax.toLocaleString("pt-BR")}`,
    `Bairros preferidos: ${neighborhoods}`,
    `Aceita pets: ${filters.petsAllowed ? "sim" : "não"}`,
  ].join(" | ");
}

function trimDescription(description: string, maxChars = 500): string {
  if (description.length <= maxChars) return description;
  return description.slice(0, maxChars) + "…";
}

function isClaudeResponseItem(val: unknown): val is ClaudeResponseItem {
  return typeof val === "object" && val !== null && "id" in val && "score" in val;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function rankWithClaude(
  listings: RankingInput[],
  filters: FilterCriteria
): Promise<Map<string, ClaudeRankingResult>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn("rankWithClaude: ANTHROPIC_API_KEY not set — skipping LLM pass");
    return new Map();
  }

  const client = new Anthropic({ apiKey });

  // Cap at 30 listings
  const batch = listings.slice(0, 30);

  if (batch.length === 0) {
    return new Map();
  }

  const listingPayload = batch.map(({ listing }) => ({
    id: listing.id,
    title: listing.title,
    neighborhood: listing.neighborhood,
    area: listing.area,
    price: listing.price,
    bedrooms: listing.bedrooms,
    description: trimDescription(listing.description),
  }));

  const systemPrompt = `You are a real estate ranking assistant. You will receive a list of apartment listings in Porto Alegre, Brazil, and a buyer profile. For each listing, assign a qualitative score from 0 to 40 based on: quality of finishings mentioned, sun orientation (south-facing = 0, north/east = max), building age (newer = better), desirable amenities (pool, gym, gourmet space), neighborhood reputation, and overall description quality. Be conservative — only give high scores for genuinely excellent listings.

Respond with ONLY a JSON array (no markdown, no explanation) in this exact format:
[{"id":"<listing_id>","score":<0-40>,"rationale":"<one sentence in Portuguese>"},...]`;

  const userMessage = [
    `Perfil do comprador: ${buildBuyerProfileSummary(filters)}`,
    "",
    `Imóveis (${batch.length}):`,
    JSON.stringify(listingPayload, null, 2),
  ].join("\n");

  logger.info(
    { listingCount: batch.length },
    "rankWithClaude: calling Claude API"
  );

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    // Log token usage if available
    if (response.usage) {
      logger.info(
        {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        "rankWithClaude: token usage"
      );
    }

    // Extract text content
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      logger.warn("rankWithClaude: no text block in response");
      return new Map();
    }

    const rawText = textBlock.text.trim();

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      logger.warn(
        { parseErr, rawText: rawText.slice(0, 200) },
        "rankWithClaude: failed to parse JSON response — falling back to deterministic-only"
      );
      return new Map();
    }

    if (!Array.isArray(parsed)) {
      logger.warn(
        { type: typeof parsed },
        "rankWithClaude: response is not an array — falling back to deterministic-only"
      );
      return new Map();
    }

    const result = new Map<string, ClaudeRankingResult>();

    for (const item of parsed) {
      if (!isClaudeResponseItem(item)) continue;

      const id = typeof item.id === "string" ? item.id : String(item.id);
      const score =
        typeof item.score === "number"
          ? Math.max(0, Math.min(40, item.score))
          : 0;
      const rationale =
        typeof item.rationale === "string" ? item.rationale : "";

      result.set(id, { qualitativeScore: score, rationale });
    }

    logger.info(
      { ranked: result.size },
      "rankWithClaude: qualitative scoring complete"
    );

    return result;
  } catch (err) {
    logger.error({ err }, "rankWithClaude: API call failed — falling back to deterministic-only");
    return new Map();
  }
}
