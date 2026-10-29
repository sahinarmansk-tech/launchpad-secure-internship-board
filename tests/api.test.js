import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "internship-api-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.ADMIN_API_KEY = "test-admin-key-for-tests";
const { app } = await import("../src/app.js");
const { db } = await import("../src/db.js");
let server, base;
before(async () => {
  const seed = JSON.parse(fs.readFileSync(new URL("../data/seed.json", import.meta.url), "utf8"));
  const ins = db.prepare("INSERT INTO internships(id,title,domain,mode,location,skills,openings,duration_weeks,applications_open) VALUES(?,?,?,?,?,?,?,?,?)");
  for (const x of seed.internships) ins.run(x.id, x.title, x.domain, x.mode, x.location, JSON.stringify(x.skills), x.openings, x.duration_weeks ?? null, x.applications_open ? 1 : 0);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(r => server.close(r));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("health, security headers, pagination and API response", async () => {
  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  assert.ok(health.headers.get("x-content-type-options"));
  assert.equal(health.headers.get("x-powered-by"), null);
  const r = await fetch(base + "/api/internships?page=1&limit=2");
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.data.length, 2);
  assert.equal(b.pagination.total, 5);
  assert.ok(r.headers.get("ratelimit-limit"));
});

test("create/read/update/delete lifecycle", async () => {
  const payload = { id: "TEST-1", title: "QA Intern", domain: "Testing", mode: "Remote", location: "India", skills: ["QA"], openings: 2 };
  let r = await fetch(base + "/api/internships", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer test-admin-key-for-tests" }, body: JSON.stringify(payload) });
  assert.equal(r.status, 201);
  r = await fetch(base + "/api/internships/TEST-1"); assert.equal(r.status, 200);
  r = await fetch(base + "/api/internships/TEST-1", { method: "PATCH", headers: { "content-type": "application/json", authorization: "Bearer test-admin-key-for-tests" }, body: JSON.stringify({ openings: 1 }) });
  assert.equal((await r.json()).data.openings, 1);
  r = await fetch(base + "/api/internships/TEST-1", { method: "DELETE", headers: { authorization: "Bearer test-admin-key-for-tests" } }); assert.equal(r.status, 204);
  r = await fetch(base + "/api/internships/TEST-1"); assert.equal(r.status, 404);
});

test("catalogue write operations require admin authentication", async () => {
  const r = await fetch(base + "/api/internships", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "QA Intern", domain: "Testing", mode: "Remote", location: "India", skills: [], openings: 1 })
  });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error.code, "ADMIN_AUTH_REQUIRED");
});

test("invalid input and pagination are rejected", async () => {
  let r = await fetch(base + "/api/internships", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer test-admin-key-for-tests" }, body: JSON.stringify({ title: "x", domain: "Web", mode: "Office", location: "India", openings: -1 }) });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, "VALIDATION_ERROR");
  r = await fetch(base + "/api/internships?page=0&limit=500"); assert.equal(r.status, 400);
});

test("application form accepts valid data and rejects invalid data", async () => {
  let r = await fetch(base + "/api/applications", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Applicant", email: "applicant@example.com", internshipId: "INT-101", resumeUrl: "https://example.com/resume" })
  });
  assert.equal(r.status, 201);
  const result = await r.json();
  assert.match(result.data.id, /^APP-/);
  r = await fetch(base + "/api/applications", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x", email: "not-an-email", internshipId: "INT-101" })
  });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, "VALIDATION_ERROR");
});

test("frontend is served from the same origin", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  assert.match(await r.text(), /Apply for an internship/);
});
