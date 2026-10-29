import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || path.join(here, "../data/internships.db"));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS internships (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 domain TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('Remote','Hybrid','On-site')),
 location TEXT NOT NULL,
 skills TEXT NOT NULL DEFAULT '[]',
 openings INTEGER NOT NULL CHECK(openings >= 0),
 duration_weeks INTEGER CHECK(duration_weeks IS NULL OR duration_weeks > 0),
 applications_open INTEGER NOT NULL DEFAULT 1 CHECK(applications_open IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

db.exec(`
CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY,
 internship_id TEXT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 resume_url TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
