# Security checklist

## Implemented in this project
- [x] Helmet security headers enabled; `X-Powered-By` disabled.
- [x] API-wide request rate limit and stricter application-submission limit.
- [x] JSON request body capped at 20 KB.
- [x] Server-side Zod validation; unknown request fields are rejected.
- [x] Parameterized SQLite queries for user-controlled values.
- [x] Catalogue create/update/delete require an admin bearer token; writes are disabled when `ADMIN_API_KEY` is unset.
- [x] Same-origin frontend/API; no wildcard CORS policy.
- [x] Consistent error responses avoid exposing stack traces.
- [x] `.env`, database files, and dependencies are excluded from Git.
- [x] Frontend builds DOM nodes with `textContent` rather than inserting API values as HTML.
- [x] Application POST is not automatically retried, reducing accidental duplicate submissions after ambiguous failures.

## Required before public deployment
- [ ] Set a long, unique `ADMIN_API_KEY` using the host's secret/environment settings; never place it in frontend JavaScript.
- [ ] Enforce HTTPS and verify host security settings.
- [ ] Confirm SQLite storage is persistent; use managed storage for multi-instance deployments.
- [ ] Configure a shared rate-limit store if running multiple server instances.
- [ ] Move inline CSS/JavaScript into separate files if strengthening Content Security Policy to remove `unsafe-inline`.
- [ ] Add authentication/authorization and privacy/retention rules if applicants can view or manage personal application records in future versions.
- [ ] Do not collect real applicant data during demo testing.
