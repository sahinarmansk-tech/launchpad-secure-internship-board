# LaunchPad — Secure Internship Board

A full-stack, responsive internship management platform built using **Node.js, Express, SQLite, HTML, CSS, and JavaScript**.

LaunchPad allows users to browse internship opportunities, search and filter listings, submit applications, and track application statuses. Administrators can manage internship listings, review applications, and update application statuses through a secure dashboard.

## Live Demo

🚀 **Live Application:** https://launchpad.de.deplexo.com/

**GitHub Repository:** https://github.com/sahinarmansk-tech/launchpad-secure-internship-board

## Features

### 1. Internship Portal
- Responsive internship listing interface.
- Search internships by keyword.
- Filter opportunities by domain and work mode.
- View internship details and requirements.
- Loading, empty, error, and retry states.

### 2. Application Management
- Submit internship applications.
- Client-side and server-side validation.
- Unique application reference IDs.
- Persistent application storage using SQLite.

### 3. Admin Dashboard
- Secure administrator access.
- View application statistics.
- View submitted applications.
- Manage internship listings.
- Create, update, and delete internship records.
- Review applications and update their statuses.

### 4. Applicant Dashboard
- Applicant registration and login.
- View submitted applications.
- Track application status.
- See application reference IDs and submission dates.

### 5. Application Status Tracking

Applications support the following statuses:

- Pending
- Under Review
- Shortlisted
- Accepted
- Rejected

Administrators can update an application's status, and applicants can view the updated status in their dashboard.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite |
| Database Library | better-sqlite3 |
| Validation | Zod |
| Security | Helmet, Rate Limiting |
| Testing | Node.js Test Runner |
| Deployment | Deplexo |

## Project Requirements

- Node.js 20 or newer
- npm

## Run Locally

Clone the repository:

```bash
git clone https://github.com/sahinarmansk-tech/launchpad-secure-internship-board.git
```

Navigate into the project:

```bash
cd launchpad-secure-internship-board
```

Install dependencies:

```bash
npm install
```

Configure the administrator API key in PowerShell:

```powershell
$env:ADMIN_API_KEY = "your-long-random-secret"
```

Seed the database:

```bash
npm run seed
```

Start the application:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

The SQLite database is created at `data/internships.db` by default.

## Environment Variables

| Variable | Purpose |
|---|---|
| PORT | Server port |
| DATABASE_PATH | SQLite database location |
| ADMIN_API_KEY | Administrator API authentication |

Set secrets through your hosting provider's environment-variable settings. Never commit real API keys or `.env` files.

## API Endpoints

### Public Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/internships` | List internships |
| GET | `/api/internships/:id` | View one internship |
| POST | `/api/applications` | Submit an application |

### Administrator Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/applications` | View submitted applications |
| PATCH | `/api/admin/applications/:id/status` | Update application status |
| POST | `/api/internships` | Create internship |
| PATCH | `/api/internships/:id` | Update internship |
| DELETE | `/api/internships/:id` | Delete internship |

Administrator endpoints require appropriate authorization using the configured administrator API key.

### Applicant Endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/intern/applications` | View the authenticated applicant's applications |

Internship listing supports pagination and filtering by domain and work mode.

## Security Features

- Helmet security headers.
- API rate limiting.
- Request body-size limits.
- Server-side input validation using Zod.
- Parameterized SQL queries.
- Protected administrator endpoints.
- Consistent API error responses.
- HTTPS deployment.

## Testing

Run the automated test suite:

```bash
npm test
```

Tests cover:

- Health checks and security headers.
- Internship listing and pagination.
- CRUD operations.
- Unauthorized administrator write rejection.
- Invalid input handling.
- Application submission and validation.
- Frontend serving.

See [TEST-REPORT.md](TEST-REPORT.md) for test evidence.

## Deployment

The application is deployed on Deplexo.

Deployment configuration includes:

- Node.js application hosting.
- Persistent SQLite database storage.
- Administrator API key configured as a secret.
- Health-check endpoint at `/health`.
- HTTPS access.

The database must use persistent storage to preserve applications and internship records across deployments.

## Security Checklist

Refer to [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md) for the project's security review.

## Project Objective

The objective of LaunchPad is to provide a secure and accessible platform that simplifies internship discovery, application management, and communication between applicants and administrators.

---

**LaunchPad — Discover Opportunities. Apply. Track Your Progress.**
