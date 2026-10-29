# Launchpad — Secure Internship Board

An accessible, responsive internship board served by a Node.js + Express API. The frontend fetches live records from the same-origin API, shows loading/empty/error states, retries transient read failures, and submits validated applications. SQLite persists internships and applications.

## Requirements
- Node.js 20 or newer
- npm

## Run locally
```bash
npm install
# Configure ADMIN_API_KEY in your shell or hosting environment before using catalogue write endpoints.
# PowerShell example for the current terminal:
$env:ADMIN_API_KEY = "replace-with-a-long-random-secret"
npm run seed
npm start
```
Open `http://localhost:3000`. The API and frontend share the same origin, so no permissive CORS configuration is needed. The SQLite database is created at `data/internships.db` by default. Optional variables: `PORT`, `DATABASE_PATH`, `ADMIN_API_KEY`.

For PowerShell, set `ADMIN_API_KEY` to a long random value; for deployment, set it in the host's environment-variable settings. `.env.example` is a template only. Do not commit `.env` or real keys.

## Features
- Responsive, keyboard-friendly internship listings and filters.
- Loading, empty, connection-failure, and retry states.
- Application form with browser-side constraints and server-side Zod validation.
- SQLite persistence for applications.
- Pagination and domain/mode filters.
- Helmet security headers, JSON body-size limit, rate limiting, consistent errors, and parameterized SQL.
- Admin bearer-token protection for catalogue create/update/delete endpoints. Without `ADMIN_API_KEY`, catalogue writes are disabled. Public browsing and application submission remain available.

## API endpoints
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/health` | Health check | No |
| GET | `/api/internships?page=1&limit=10` | List and filter records | No |
| GET | `/api/internships/:id` | Read one record | No |
| POST | `/api/applications` | Submit an application | No; rate limited |
| POST | `/api/internships` | Create catalogue record | `Authorization: Bearer <ADMIN_API_KEY>` |
| PATCH | `/api/internships/:id` | Update catalogue record | `Authorization: Bearer <ADMIN_API_KEY>` |
| DELETE | `/api/internships/:id` | Delete catalogue record | `Authorization: Bearer <ADMIN_API_KEY>` |

List filters: `domain` and `mode`. Pagination defaults to page 1 and limit 10; limit must be 1–100. Success responses use a `data` property; errors use `{ "error": { "code": "...", "message": "..." } }`.

## Test
```bash
npm test
```
Tests cover health/security headers, pagination, CRUD, unauthenticated write rejection, invalid inputs, application submission/validation, and serving the frontend.

## Deployment notes
Deploy the whole repository to a Node.js-capable host (not static-only hosting), configure `ADMIN_API_KEY` as a secret environment variable, and use HTTPS. The SQLite file system must be persistent on the host; if the host has ephemeral storage or multiple instances, use a managed database instead. Rate limits are in-memory per process, so production multi-instance deployments should use a shared rate-limit store.

## Security checklist
See [`SECURITY-CHECKLIST.md`](SECURITY-CHECKLIST.md). Test results and any environment-specific checks are recorded in [`TEST-REPORT.md`](TEST-REPORT.md).
