# IshHaqqi — ish haqi va avanslar boshqaruvi

Full-stack web application for a single administrator managing ~20–100 employees: monthly salaries
(with history), cash advances, remaining salary, dashboards and monthly reports. UI is in Uzbek (Latin),
currency is UZS (so'm), timezone `Asia/Tashkent`.

| Part | Stack |
| --- | --- |
| `client/` | React 18, Vite, TypeScript, Tailwind CSS, shadcn-style Radix UI components, React Router, TanStack Query, React Hook Form + Zod, Lucide, Recharts |
| `server/` | Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Zod, bcrypt, JWT in HTTP-only cookie + CSRF token |
| Tests | Vitest + Supertest (API), Vitest (frontend utils), Playwright (E2E, desktop + mobile) |

## Features

- **Login** (no public registration), HTTP-only session cookie, CSRF protection, login rate limiting, password change.
- **Bosh sahifa** — active employees, total monthly salaries, advances given this month, remaining salary,
  6‑month salary/advance chart, recent advances, top advance recipients, month/year selector, quick actions.
- **Xodimlar** — create/edit/view, search, status filter, sorting, pagination, activate/deactivate
  (history is never deleted), salary history, advance history, per-month summary.
- **Avanslar** — create/edit/delete (with confirmation), filter by month or date range, employee, text search,
  sorting, pagination, period total.
- **Hisobotlar** — monthly report per employee (salary, advances, remaining, percentage), employee and status
  filters, totals, CSV export (UTF‑8, Excel friendly), print-friendly layout.
- **Sozlamalar** — password change and the calculation rules below.

## Calculation rules

- Money is stored as integer so'm (no floating point).
- A salary record is effective from the **first day of a month**. The salary for month *M* is the record with the
  latest `effectiveFrom <= first day of M`. Only one record per employee per month (DB unique constraint);
  changing the salary "from October" therefore applies to the whole of October and later months, while earlier
  months keep their historical salary, so past reports stay reproducible.
- `remaining = applicable monthly salary − sum of advances dated inside the selected month`.
  Negative values are kept (shown in red) — they mean the employee received more than the salary.
- `advance % = advances / salary × 100`; with a zero salary the percentage is shown as "—".
- All totals are computed on the server; the frontend never sends totals.

## Local development

Requirements: Node.js 20+ (tested with 22), PostgreSQL 14+ (tested with 16).

```bash
# 1. Database (example with Docker)
docker run -d --name ishpg -e POSTGRES_USER=ish -e POSTGRES_PASSWORD=ish -e POSTGRES_DB=ishhaqqi -p 5432:5432 postgres:16

# 2. API
cd server
cp .env.example .env          # set DATABASE_URL and JWT_SECRET (openssl rand -hex 32)
npm install
npm run db:migrate            # applies prisma/migrations
npm run admin:create -- admin  # prompts for the password (hidden); add --reset to change it
npm run dev                   # http://localhost:4000, health: /api/health

# 3. Frontend (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4000)
```

Instead of the CLI you may set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `server/.env`; the admin is created on
startup **only if no user exists yet**. Remove these values afterwards.

## Tests and checks

```bash
cd server && npm run typecheck && npm run lint && npm test        # needs PostgreSQL; uses database "<name>_test"
cd client && npm run typecheck && npm run lint && npm test && npm run build
cd client && npx playwright install chromium && npm run e2e         # resets database "ishhaqqi_e2e" each run
```

The E2E suite runs the full workflow: login (and invalid login), protected routes, create *Ali Valiyev* with a
5 000 000 so'm salary, 500 000 advance → 4 500 000 remaining, 700 000 advance → 1 200 000 total / 3 800 000
remaining, edit and delete the second advance, previous-month advance does not mix with the current month,
CSV export, refresh persistence, logout, and a mobile viewport pass checking navigation and horizontal overflow.
Override the database with `E2E_DATABASE_URL`.

## API overview

All endpoints are under `/api`, require the session cookie (except login/health) and require the
`X-CSRF-Token` header for POST/PUT/PATCH/DELETE (token is returned by `/auth/login` and `/auth/me`).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check (also checks the DB) |
| POST | `/auth/login`, `/auth/logout` · GET `/auth/me` · PUT `/auth/password` | Auth |
| GET/POST | `/employees` | List (search, status, sort, page) / create (with initial salary) |
| GET | `/employees/options` | Lightweight list for selects |
| GET/PUT | `/employees/:id` | Detail / update |
| PATCH | `/employees/:id/status` | Activate / deactivate |
| GET/POST | `/employees/:id/salary-history` · DELETE `/employees/:id/salary-history/:salaryId` | Salary history |
| GET | `/employees/:id/advances`, `/employees/:id/monthly-summary?month=YYYY-MM` | Employee advances / monthly summary |
| GET/POST | `/advances` · GET/PUT/DELETE `/advances/:id` | Advances |
| GET | `/reports/monthly?month=YYYY-MM`, `/reports/monthly.csv` | Monthly report / CSV |
| GET | `/dashboard/stats?month=YYYY-MM` | Dashboard data |

## Deployment (Render API + PostgreSQL, Vercel frontend)

Recommended setup keeps the browser on a single origin: Vercel serves the SPA and **rewrites `/api/*` to the
Render API**, so the session cookie is first-party and `COOKIE_SAMESITE=lax` works.

1. **Render** — New → Blueprint → select this repository. `render.yaml` creates the `ish-haqqi-api` web service
   (root `server/`, `npm ci && npm run build`, pre-deploy `npm run db:deploy`, health check `/api/health`) and a
   managed PostgreSQL `ish-haqqi-db`. `JWT_SECRET` is generated automatically. Set:
   - `CORS_ORIGIN` = your Vercel URL, e.g. `https://ish-haqqi.vercel.app`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` for the first start (then delete them), or run
     `npm run admin:create:prod -- admin` from the Render shell (prompts for the password).
2. **Vercel** — import the repository, Root Directory `client`, framework Vite. In `client/vercel.json` replace
   `REPLACE-WITH-BACKEND-HOST` with the Render host (e.g. `ish-haqqi-api.onrender.com`) and commit. Leave
   `VITE_API_URL` empty.
3. Verify: `https://<render-host>/api/health` returns `{"status":"ok",...}`, then open the Vercel URL and log in.

Alternative (no rewrite): set `VITE_API_URL=https://<render-host>` on Vercel and `COOKIE_SAMESITE=none` on Render
(requires HTTPS; some browsers block third-party cookies, so the rewrite setup is preferred).

### Production environment variables (server)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | ≥ 32 random characters |
| `CORS_ORIGIN` | yes | Comma-separated exact frontend origins |
| `NODE_ENV` | yes | `production` (enables secure cookies) |
| `COOKIE_SAMESITE` | no | `lax` (default) or `none` |
| `SESSION_HOURS` | no | Default 12 |
| `PORT` | no | Provided by the host |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | no | One-time bootstrap only |
