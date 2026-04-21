/**
 * GET /api/scrape/run/[id]
 * Returns a scrape run by id as JSON. Used for future polling.
 */

import { NextResponse } from "next/server";
import { getScrapeRunById } from "@/db/queries/listings";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const runId = parseInt(id, 10);

  if (isNaN(runId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const run = getScrapeRunById(runId);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
