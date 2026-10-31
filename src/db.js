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

/*
 * Intern accounts
 * Passwords will be stored as secure hashes, never plain text.
 */
db.exec(`
CREATE TABLE IF NOT EXISTS interns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

/*
 * Link applications to intern accounts.
 * Existing applications remain unchanged.
 */
const applicationColumns = db
  .prepare("PRAGMA table_info(applications)")
  .all();

const hasInternId = applicationColumns.some(
  column => column.name === "intern_id"
);

if (!hasInternId) {
  db.exec(`
    ALTER TABLE applications
    ADD COLUMN intern_id TEXT REFERENCES interns(id)
    ON DELETE SET NULL;
  `);
}

db.exec(`
CREATE INDEX IF NOT EXISTS idx_applications_intern_id
ON applications(intern_id);
`);


/*
 * Secure intern login sessions.
 * Only a hash of the session token is stored in the database.
 */
db.exec(`
CREATE TABLE IF NOT EXISTS intern_sessions (
  token_hash TEXT PRIMARY KEY,
  intern_id TEXT NOT NULL
    REFERENCES interns(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

db.exec(`
CREATE INDEX IF NOT EXISTS idx_intern_sessions_expires_at
ON intern_sessions(expires_at);
`);

// Seed sample internships automatically when the database is empty.
const internshipCount = db
  .prepare("SELECT COUNT(*) AS count FROM internships")
  .get().count;

if (internshipCount === 0) {
  const seedPath = path.resolve(here, "../data/seed.json");

  if (fs.existsSync(seedPath)) {
    const { internships } = JSON.parse(
      fs.readFileSync(seedPath, "utf8")
    );

    const insertInternship = db.prepare(`
      INSERT INTO internships (
        id, title, domain, mode, location, skills,
        openings, duration_weeks, applications_open
      )
      VALUES (
        @id, @title, @domain, @mode, @location, @skills,
        @openings, @duration_weeks, @applications_open
      )
    `);

    const seedDatabase = db.transaction((items) => {
      for (const internship of items) {
        insertInternship.run({
          ...internship,
          skills: JSON.stringify(internship.skills || []),
          duration_weeks: internship.duration_weeks ?? null,
          applications_open:
            internship.applications_open === false ? 0 : 1,
        });
      }
    });

    seedDatabase(internships);
    console.log(`Seeded ${internships.length} internship records.`);
  }
}
