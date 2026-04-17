/**
 * SQLite singleton client using better-sqlite3.
 * Runs all pending migrations on first import.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? "./data/listings.db";

// Ensure the directory exists
const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Singleton instance
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(path.resolve(DB_PATH));

  // WAL mode for better concurrent read performance
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  runMigrations(_db);

  return _db;
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "src/db/migrations");

function runMigrations(db: Database.Database): void {
  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT    NOT NULL UNIQUE,
      applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn("[db] migrations directory not found:", MIGRATIONS_DIR);
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // lexicographic order — 001_, 002_, etc.

  const applied = new Set(
    (
      db
        .prepare("SELECT filename FROM _migrations")
        .all() as { filename: string }[]
    ).map((r) => r.filename)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    console.info(`[db] applying migration: ${file}`);

    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(file);
    })();
  }
}

// Export default singleton for convenience
export default getDb;
