/**
 * API routes for filter profile management.
 * GET  /api/profile  — fetch active profile (or default)
 * POST /api/profile  — save/update active profile
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import getDb from "@/db/client";
import type { FilterProfile, FilterProfileRow } from "@/types";

// ---------------------------------------------------------------------------
// Zod schema for incoming profile data
// ---------------------------------------------------------------------------

const FilterCriteriaSchema = z.object({
  priceMin: z.number().min(0).default(0),
  priceMax: z.number().min(0).default(999_999_999),
  condoFeeMax: z.number().min(0).default(999_999),
  iptuMax: z.number().min(0).default(999_999),
  totalMonthlyMax: z.number().min(0).default(999_999),
  areaMin: z.number().min(0).default(0),
  bedroomsMin: z.number().int().min(0).default(0),
  suitesMin: z.number().int().min(0).default(0),
  parkingMin: z.number().int().min(0).default(0),
  neighborhoods: z.array(z.string()).default([]),
  petsAllowed: z.boolean().default(false),
  excludeKeywords: z.array(z.string()).default([]),
});

const SaveProfileSchema = z.object({
  name: z.string().min(1).default("Meu Perfil"),
  filters: FilterCriteriaSchema,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToProfile(row: FilterProfileRow): FilterProfile {
  return {
    id: row.id,
    name: row.name,
    filters: JSON.parse(row.filters),
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active as 0 | 1,
  };
}

const DEFAULT_FILTERS = {
  priceMin: 300_000,
  priceMax: 900_000,
  condoFeeMax: 1_500,
  iptuMax: 500,
  totalMonthlyMax: 10_000,
  areaMin: 60,
  bedroomsMin: 2,
  suitesMin: 1,
  parkingMin: 1,
  neighborhoods: [],
  petsAllowed: false,
  excludeKeywords: [],
};

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();

    const row = db
      .prepare("SELECT * FROM filter_profiles WHERE is_active = 1 LIMIT 1")
      .get() as FilterProfileRow | undefined;

    if (row) {
      return NextResponse.json(rowToProfile(row));
    }

    // No active profile — return a sensible default (don't insert)
    const defaultProfile: FilterProfile = {
      id: 0,
      name: "Meu Perfil",
      filters: DEFAULT_FILTERS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: 1,
    };

    return NextResponse.json(defaultProfile);
  } catch (err) {
    console.error("[api/profile GET]", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar perfil." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/profile
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = SaveProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { name, filters } = parsed.data;
    const filtersJson = JSON.stringify(filters);
    const db = getDb();

    // Check if an active profile exists
    const existing = db
      .prepare("SELECT id FROM filter_profiles WHERE is_active = 1 LIMIT 1")
      .get() as { id: number } | undefined;

    let profileId: number;

    if (existing) {
      // Update existing active profile
      db.prepare(
        `UPDATE filter_profiles
         SET name = ?, filters = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(name, filtersJson, existing.id);
      profileId = existing.id;
    } else {
      // Insert new profile and mark as active
      const result = db
        .prepare(
          `INSERT INTO filter_profiles (name, filters, is_active)
           VALUES (?, ?, 1)`
        )
        .run(name, filtersJson);
      profileId = result.lastInsertRowid as number;
    }

    const updated = db
      .prepare("SELECT * FROM filter_profiles WHERE id = ?")
      .get(profileId) as FilterProfileRow;

    return NextResponse.json(rowToProfile(updated), { status: 200 });
  } catch (err) {
    console.error("[api/profile POST]", err);
    return NextResponse.json(
      { error: "Erro interno ao salvar perfil." },
      { status: 500 }
    );
  }
}
