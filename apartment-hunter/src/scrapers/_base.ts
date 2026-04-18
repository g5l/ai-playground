/**
 * Base scraper interface and shared utilities for Apartment Hunter POA.
 */

import fs from "fs";
import path from "path";
import logger from "@/lib/logger";
import type { FilterCriteria, RawListing } from "@/types/index";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const USER_AGENT =
  "PersonalApartmentHunter/1.0 (+https://github.com/gabrieldebona/apartment-hunter)";

export const RATE_LIMIT_MS = parseInt(
  process.env.SCRAPE_RATE_LIMIT_MS ?? "2000",
  10
);

// ---------------------------------------------------------------------------
// Scraper interface
// ---------------------------------------------------------------------------

export interface Scraper {
  source: string;
  search(filters: FilterCriteria): AsyncGenerator<RawListing>;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

// Track last-call time per host
const lastCallTime: Map<string, number> = new Map();

/**
 * Returns a rate-limiter function for a given host.
 * Each call enforces a minimum delay of `hostMs` ±20% jitter.
 */
export function rateLimiter(hostMs: number): (host: string) => Promise<void> {
  return async function wait(host: string): Promise<void> {
    const jitter = hostMs * 0.2 * (Math.random() * 2 - 1); // ±20%
    const delay = hostMs + jitter;
    const last = lastCallTime.get(host) ?? 0;
    const elapsed = Date.now() - last;
    const remaining = delay - elapsed;
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
    lastCallTime.set(host, Date.now());
  };
}

// ---------------------------------------------------------------------------
// fetchWithRetry
// ---------------------------------------------------------------------------

/**
 * Fetches a URL with exponential backoff on 429/503.
 * On other HTTP errors or network errors, throws immediately.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const response = await fetch(url, options);

    if (response.ok) {
      return response;
    }

    if (response.status === 429 || response.status === 503) {
      if (attempt >= maxRetries) {
        throw new Error(
          `fetchWithRetry: giving up after ${maxRetries} retries (status ${response.status}) for ${url}`
        );
      }
      const backoffMs = 1000 * Math.pow(2, attempt);
      logger.warn(
        { url, status: response.status, attempt, backoffMs },
        "fetchWithRetry: backing off"
      );
      await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
      attempt++;
      continue;
    }

    // Any other non-ok status — throw immediately
    throw new Error(
      `fetchWithRetry: HTTP ${response.status} for ${url}`
    );
  }
}

// ---------------------------------------------------------------------------
// robots.txt checker
// ---------------------------------------------------------------------------

interface RobotsRules {
  disallowed: string[];
}

const robotsCache: Map<string, RobotsRules> = new Map();

/**
 * Fetches and parses robots.txt for a host (cached per host).
 * Returns true if the given path is allowed, false if disallowed.
 */
export async function checkRobotsTxt(
  host: string,
  urlPath: string
): Promise<boolean> {
  if (!robotsCache.has(host)) {
    const rules = await fetchRobotsRules(host);
    robotsCache.set(host, rules);
  }

  const rules = robotsCache.get(host)!;
  const isDisallowed = rules.disallowed.some((prefix) =>
    urlPath.startsWith(prefix)
  );

  if (isDisallowed) {
    logger.warn({ host, path: urlPath }, "checkRobotsTxt: path is disallowed");
    return false;
  }
  return true;
}

async function fetchRobotsRules(host: string): Promise<RobotsRules> {
  const robotsUrl = `${host}/robots.txt`;
  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      // If we can't fetch robots.txt, assume everything is allowed
      return { disallowed: [] };
    }

    const text = await response.text();
    return parseRobotsTxt(text);
  } catch {
    // Network error — assume allowed
    return { disallowed: [] };
  }
}

function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split("\n");
  const disallowed: string[] = [];
  let inOurBlock = false; // tracks if we're in a User-agent: * block

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("#") || line === "") continue;

    const lower = line.toLowerCase();

    if (lower.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      inOurBlock = agent === "*";
      continue;
    }

    if (inOurBlock && lower.startsWith("disallow:")) {
      const disallowPath = line.slice("disallow:".length).trim();
      if (disallowPath) {
        disallowed.push(disallowPath);
      }
    }
  }

  return { disallowed };
}

// ---------------------------------------------------------------------------
// saveRawResponse
// ---------------------------------------------------------------------------

/**
 * Saves raw scraped content to data/raw/<source>/<listingId>-<timestamp>.<ext>.
 * Creates the directory if it doesn't exist.
 */
export async function saveRawResponse(
  source: string,
  listingId: string,
  content: string,
  ext: "html" | "json"
): Promise<void> {
  const dir = path.join(process.cwd(), "data", "raw", source);
  await fs.promises.mkdir(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${listingId}-${timestamp}.${ext}`;
  const filePath = path.join(dir, filename);

  await fs.promises.writeFile(filePath, content, "utf-8");
  logger.debug({ filePath }, "saveRawResponse: saved raw file");
}
