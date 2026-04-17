/**
 * Standalone migration runner.
 * Usage: pnpm migrate
 * Uses the same logic as src/db/client.ts but can be run outside Next.js.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Support ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DB_PATH = process.env.DB_PATH ?? "./data/listings.db";
const MIGRATIONS_DIR = path.join(ROOT, "src/db/migrations");

function main(): void {
  const dbAbsPath = path.resolve(ROOT, DB_PATH);
  const dbDir = path.dirname(dbAbsPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.info(`[migrate] created directory: ${dbDir}`);
  }

  console.info(`[migrate] opening database: ${dbAbsPath}`);
  const db = new Database(dbAbsPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Ensure tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT    NOT NULL UNIQUE,
      applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[migrate] migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (
      db
        .prepare("SELECT filename FROM _migrations")
        .all() as { filename: string }[]
    ).map((r) => r.filename)
  );

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.info(`[migrate] already applied: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    console.info(`[migrate] applying: ${file}`);

    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(file);
    })();

    count++;
    console.info(`[migrate] applied: ${file}`);
  }

  if (count === 0) {
    console.info("[migrate] nothing to migrate — all up to date.");
  } else {
    console.info(`[migrate] done — applied ${count} migration(s).`);
  }

  db.close();
}

main();
