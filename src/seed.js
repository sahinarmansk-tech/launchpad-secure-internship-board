import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const { internships } = JSON.parse(fs.readFileSync(path.resolve(here,"../data/seed.json"),"utf8"));
const insert = db.prepare(`INSERT INTO internships(id,title,domain,mode,location,skills,openings,duration_weeks,applications_open)
VALUES(@id,@title,@domain,@mode,@location,@skills,@openings,@duration_weeks,@applications_open)
ON CONFLICT(id) DO UPDATE SET title=excluded.title,domain=excluded.domain,mode=excluded.mode,location=excluded.location,
skills=excluded.skills,openings=excluded.openings,duration_weeks=excluded.duration_weeks,
applications_open=excluded.applications_open,updated_at=CURRENT_TIMESTAMP`);
const run = db.transaction(items => items.forEach(x => insert.run({...x,skills:JSON.stringify(x.skills || []),
duration_weeks:x.duration_weeks ?? null,applications_open:x.applications_open === false ? 0 : 1})));
run(internships); console.log(`Seeded ${internships.length} internship records`); db.close();
