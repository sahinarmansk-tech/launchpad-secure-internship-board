import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db.js";
import { createSchema, updateSchema, pagination, applicationSchema } from "./validation.js";

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);

  return `${salt}:${derivedKey.toString("hex")}`;
}


const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "launchpad_intern_session";

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyPassword(password, storedHash) {
  try {
    const [salt, hashHex] = storedHash.split(":");
    if (
      !salt || !hashHex ||
      !/^[a-f0-9]{32}$/i.test(salt) ||
      !/^[a-f0-9]{128}$/i.test(hashHex)
    ) return false;

    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptAsync(password, salt, expected.length);

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function readSessionToken(req) {
  const cookies = req.get("cookie") || "";
  const entry = cookies.split(";").map(value => value.trim())
    .find(value => value.startsWith(SESSION_COOKIE + "="));

  if (!entry) return null;

  const token = entry.slice(SESSION_COOKIE.length + 1);

  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS
  };
}

function requireIntern(req, res, next) {
  const token = readSessionToken(req);

  if (!token) {
    return fail(res, 401, "LOGIN_REQUIRED", "Please sign in.");
  }

  const session = db.prepare(`
    SELECT i.id, i.name, i.email
    FROM intern_sessions AS s
    JOIN interns AS i ON i.id = s.intern_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashSessionToken(token), Date.now());

  if (!session) {
    return fail(res, 401, "SESSION_EXPIRED", "Please sign in again.");
  }

  req.intern = session;
  next();
}

export const app = express();
app.set('trust proxy', 1);
const here = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(helmet({
  // The UI uses inline CSS and JavaScript in a single self-contained HTML file.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "20kb", strict: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } }
});
const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "APPLICATION_RATE_LIMITED", message: "Too many applications from this connection. Please try again later." } }
});
app.use("/api", apiLimiter);

const find = id => db.prepare("SELECT * FROM internships WHERE id = ?").get(id);
const out = row => row && ({
  ...row,
  skills: JSON.parse(row.skills),
  applications_open: Boolean(row.applications_open)
});
const fail = (res, status, code, message, details) => res.status(status).json({
  error: { code, message, ...(details ? { details } : {}) }
});
const validationFail = (res, error) => fail(res, 400, "VALIDATION_ERROR", "Request validation failed",
  error.issues.map(i => ({ field: i.path.join(".") || "body", message: i.message })));

// Public visitors can browse and apply, but internship catalogue mutations require an admin key.
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return fail(res, 503, "ADMIN_WRITES_DISABLED", "Catalogue changes are disabled until ADMIN_API_KEY is configured");
  const supplied = req.get("authorization") || "";
  const prefix = "Bearer ";
  if (!supplied.startsWith(prefix)) return fail(res, 401, "ADMIN_AUTH_REQUIRED", "A valid admin bearer token is required");
  const actualBuffer = Buffer.from(supplied.slice(prefix.length));
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return fail(res, 401, "ADMIN_AUTH_REQUIRED", "A valid admin bearer token is required");
  }
  return next();
}

app.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));


const internAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "AUTH_RATE_LIMITED",
      message: "Too many account requests. Please try again later."
    }
  }
});

app.post("/api/intern/register", internAuthLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return fail(
        res, 400, "VALIDATION_ERROR",
        "Name, email and password are required."
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 100) {
      return fail(
        res, 400, "VALIDATION_ERROR",
        "Name must contain 2 to 100 characters."
      );
    }

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return fail(
        res, 400, "VALIDATION_ERROR",
        "Enter a valid email address."
      );
    }

    if (
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 1024
    ) {
      return fail(
        res, 400, "VALIDATION_ERROR",
        "Password must be at least 12 characters and no more than 1024 bytes."
      );
    }

    const existing = db.prepare(
      "SELECT id FROM interns WHERE email = ?"
    ).get(cleanEmail);

    if (existing) {
      return fail(
        res, 409, "ACCOUNT_EXISTS",
        "An account with this email already exists."
      );
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(password);

    try {
      db.prepare(`
        INSERT INTO interns (id, name, email, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(id, cleanName, cleanEmail, passwordHash);
    } catch (error) {
      if (error.code?.startsWith("SQLITE_CONSTRAINT")) {
        return fail(
          res, 409, "ACCOUNT_EXISTS",
          "An account with this email already exists."
        );
      }
      throw error;
    }

    res.set("Cache-Control", "no-store");

    return res.status(201).json({
      data: {
        id,
        name: cleanName,
        email: cleanEmail,
        message: "Intern account created successfully."
      }
    });
  } catch (error) {
    next(error);
  }
});


app.post("/api/intern/login", internAuthLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      password.length > 1024
    ) {
      return fail(res, 400, "VALIDATION_ERROR",
        "Valid email and password are required.");
    }

    const intern = db.prepare(`
      SELECT id, name, email, password_hash
      FROM interns
      WHERE email = ?
    `).get(email.trim().toLowerCase());

    const valid = intern
      ? await verifyPassword(password, intern.password_hash)
      : false;

    if (!valid) {
      return fail(res, 401, "INVALID_CREDENTIALS",
        "Invalid email or password.");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    db.prepare(`
      INSERT INTO intern_sessions (token_hash, intern_id, expires_at)
      VALUES (?, ?, ?)
    `).run(hashSessionToken(token), intern.id, expiresAt);

    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.set("Cache-Control", "no-store");

    return res.json({
      data: {
        id: intern.id,
        name: intern.name,
        email: intern.email
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/intern/logout", (req, res) => {
  const token = readSessionToken(req);

  if (token) {
    db.prepare(`
      DELETE FROM intern_sessions WHERE token_hash = ?
    `).run(hashSessionToken(token));
  }

  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  res.set("Cache-Control", "no-store");
  return res.json({ data: { message: "Logged out successfully." } });
});

app.get("/api/intern/me", requireIntern, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ data: req.intern });
});


app.get("/api/intern/applications", requireIntern, (req, res, next) => {
  try {
    const applications = db.prepare(`
      SELECT
        a.id,
        a.internship_id AS internshipId,
        i.title AS internshipTitle,
        a.name,
        a.email,
        a.resume_url AS resumeUrl,
        a.created_at AS appliedAt
      FROM applications AS a
      LEFT JOIN internships AS i
        ON i.id = a.internship_id
      WHERE a.intern_id = ?
      ORDER BY a.created_at DESC, a.rowid DESC
    `).all(req.intern.id);

    res.set("Cache-Control", "no-store");

    return res.json({
      data: applications,
      total: applications.length
    });
  } catch (error) {
    next(error);
  }
});


app.get("/api/internships", (req, res) => {
  const pg = pagination(req.query);
  if (pg.error) return fail(res, 400, "INVALID_PAGINATION", pg.error);
  const where = [], params = [];
  if (req.query.domain !== undefined) {
    if (typeof req.query.domain !== "string" || !req.query.domain.trim()) return fail(res, 400, "INVALID_FILTER", "domain must be a non-empty string");
    where.push("domain = ?"); params.push(req.query.domain.trim());
  }
  if (req.query.mode !== undefined) {
    if (!["Remote", "Hybrid", "On-site"].includes(req.query.mode)) return fail(res, 400, "INVALID_FILTER", "mode must be Remote, Hybrid, or On-site");
    where.push("mode = ?"); params.push(req.query.mode);
  }
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const total = db.prepare("SELECT COUNT(*) n FROM internships" + clause).get(...params).n;
  const rows = db.prepare("SELECT * FROM internships" + clause + " ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?").all(...params, pg.limit, pg.offset);
  res.json({ data: rows.map(out), pagination: { page: pg.page, limit: pg.limit, total, totalPages: Math.ceil(total / pg.limit) } });
});

app.get("/api/internships/:id", (req, res) => {
  const row = find(req.params.id);
  if (!row) return fail(res, 404, "NOT_FOUND", "Internship not found");
  res.json({ data: out(row) });
});

app.post("/api/applications", applicationLimiter, (req, res) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) return validationFail(res, parsed.error);
  const { name, email, internshipId, resumeUrl } = parsed.data;
  const internship = find(internshipId);
  if (!internship) return fail(res, 404, "INTERNSHIP_NOT_FOUND", "Selected internship does not exist");
  if (!internship.applications_open) return fail(res, 409, "APPLICATIONS_CLOSED", "Applications are closed for this internship");
  
const id = "APP-" + randomUUID().slice(0, 12).toUpperCase();

// Link the application only to a verified, signed-in intern.
let internId = null;
const sessionToken = readSessionToken(req);

if (sessionToken) {
  const session = db.prepare(`
    SELECT i.id
    FROM intern_sessions AS s
    JOIN interns AS i ON i.id = s.intern_id
    WHERE s.token_hash = ?
      AND s.expires_at > ?
  `).get(hashSessionToken(sessionToken), Date.now());

  if (session) {
    // Prevent an account from claiming another person's application.
    if (email.trim().toLowerCase() !==
        db.prepare("SELECT email FROM interns WHERE id = ?")
          .get(session.id).email.toLowerCase()) {
      return fail(
        res,
        400,
        "EMAIL_MISMATCH",
        "Please use your signed-in account email when applying."
      );
    }

    internId = session.id;
  }
}

db.prepare(`
  INSERT INTO applications
    (id, internship_id, name, email, resume_url, intern_id)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(id, internshipId, name, email, resumeUrl || null, internId);

  res.status(201).json({ data: { id, internshipId, message: "Application received" } });
});

// Only administrators can view submitted applications.
app.get("/api/admin/applications", requireAdmin, (req, res) => {
  const applications = db.prepare(`
    SELECT
      a.id,
      a.name,
      a.email,
      a.internship_id,
      i.title AS internship_title,
      a.resume_url
    FROM applications AS a
    LEFT JOIN internships AS i
      ON a.internship_id = i.id
    ORDER BY a.rowid DESC
    LIMIT 100
  `).all();

  res.set("Cache-Control", "no-store");
  res.json({ data: applications });
});
app.post("/api/internships", requireAdmin, (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationFail(res, parsed.error);
  const b = parsed.data, id = b.id || "INT-" + randomUUID().slice(0, 8).toUpperCase();
  if (find(id)) return fail(res, 409, "CONFLICT", `Internship ID '${id}' already exists`);
  db.prepare(`INSERT INTO internships(id,title,domain,mode,location,skills,openings,duration_weeks,applications_open)
    VALUES(@id,@title,@domain,@mode,@location,@skills,@openings,@duration_weeks,@applications_open)`).run({
    id, title: b.title, domain: b.domain, mode: b.mode, location: b.location, skills: JSON.stringify(b.skills ?? []),
    openings: b.openings, duration_weeks: b.duration_weeks ?? null, applications_open: b.applications_open === false ? 0 : 1
  });
  res.location(`/api/internships/${encodeURIComponent(id)}`).status(201).json({ data: out(find(id)) });
});

app.patch("/api/internships/:id", requireAdmin, (req, res) => {
  if (!find(req.params.id)) return fail(res, 404, "NOT_FOUND", "Internship not found");
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return validationFail(res, parsed.error);
  const b = parsed.data, keys = Object.keys(b);
  const values = { ...b, id: req.params.id };
  if (b.skills !== undefined) values.skills = JSON.stringify(b.skills);
  if (b.applications_open !== undefined) values.applications_open = b.applications_open ? 1 : 0;
  const allowed = ["title", "domain", "mode", "location", "skills", "openings", "duration_weeks", "applications_open"];
  const assignments = keys.filter(k => allowed.includes(k)).map(k => `${k}=@${k}`);
  db.prepare(`UPDATE internships SET ${assignments.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run(values);
  res.json({ data: out(find(req.params.id)) });
});

app.delete("/api/internships/:id", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM internships WHERE id=?").run(req.params.id);
  if (!result.changes) return fail(res, 404, "NOT_FOUND", "Internship not found");
  res.status(204).end();
});

// Serve the integrated frontend and API from the same origin.
app.use(express.static(path.resolve(here, "../public"), { index: "index.html", maxAge: "1h" }));

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) return fail(res, 400, "INVALID_JSON", "Request body must be valid JSON");
  if (err?.type === "entity.too.large") return fail(res, 413, "PAYLOAD_TOO_LARGE", "Request body must be 20 KB or smaller");
  if (err?.status === 429) return fail(res, 429, "RATE_LIMITED", "Too many requests. Please try again later.");
  console.error(err);
  return fail(res, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred");
});
app.use((_req, res) => fail(res, 404, "ROUTE_NOT_FOUND", "Route not found"));
