# BliGlömd — GDPR Deletion Request Tool

Live: **[bliglömd.se](https://xn--bliglmd-e1a.se)** &nbsp;|&nbsp; Admin: `/xadm` (role-gated)

BliGlömd helps Swedish internet users exercise their right to erasure under GDPR Article 17. It scans your email for known data breaches, identifies companies that hold your personal data, and sends legally correct deletion requests — with tracking, follow-up reminders, and a self-maintaining backend.

---

## Features

| Level | What it does |
|-------|-------------|
| **L1 — Find** | Step-by-step instructions for each company's own GDPR portal |
| **L2 — Send** | Ready-made, legally correct Swedish/English email to copy-paste |
| **L3 — Monitor** | BliGlömd sends the email automatically and tracks the response |

- **Breach scan** — powered by [XposedOrNot](https://xposedornot.com) (free, no key required)
- **Bilingual** — full Swedish/English UI, persisted per user in localStorage
- **Dashboard** — view and track all your requests (pending → sent → confirmed → removed)
- **Reminder emails** — automatic 30-day follow-up for opt-out sites with annual protection windows (Ratsit, Merinfo, Hitta.se, Birthday.se, MrKoll)
- **System status page** — real-time health of all components at `/status`
- **Admin panel** — at `/xadm`, role-gated; user management, audit log, analytics
- **Weekly digest** — automatic email to admin every Monday 07:00 UTC with key metrics

---

## Architecture

```
Browser (React SPA — GitHub Pages / bliglömd.se)
  ├── Supabase Auth          JWT sessions, email confirmation
  ├── Supabase DB            PostgreSQL + Row Level Security
  │     ├── profiles         1:1 with auth.users
  │     ├── requests         GDPR requests + status tracking
  │     ├── scans            Breach scan records
  │     ├── reminders        Scheduled follow-up reminders
  │     ├── audit_logs       Admin action log
  │     └── admin_deletions  User deletion records
  ├── Edge Function: scan-email       → XposedOrNot API (breach data)
  ├── Edge Function: send-request     → Resend API (GDPR email to company)
  ├── Edge Function: send-reminders   → Resend API (user renewal reminders)
  ├── Edge Function: delete-account   → Deletes user on their own request
  ├── Edge Function: admin-list-users → Admin: paginated user list + stats
  ├── Edge Function: admin-update-user→ Admin: change subscription level
  ├── Edge Function: admin-delete-user→ Admin: delete user + send audit email
  ├── Edge Function: admin-export-user→ Admin: export all user data as JSON
  ├── Edge Function: admin-stats      → Admin: full analytics snapshot (9 parallel queries)
  └── Edge Function: admin-weekly-digest → Automated weekly report email

Supabase Cron (pg_cron + pg_net):
  ├── send-reminders        Daily 09:00 UTC — renewal reminders
  └── admin-weekly-digest   Mondays 07:00 UTC — weekly stats to admin
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript 5.8 · Vite 6 · Tailwind CSS 3 |
| Routing | React Router v6 |
| Auth & DB | Supabase (PostgreSQL 15 + RLS) |
| Edge Functions | Supabase Edge Functions (Deno runtime) |
| Email | Resend.com |
| Hosting | GitHub Pages + custom domain |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) |
| Secrets | Supabase Edge Function Secrets + Supabase Vault |
| Scheduler | pg_cron + pg_net (managed PostgreSQL extensions) |

---

## Company Database

26 companies currently in [`src/data/companies.ts`](src/data/companies.ts).

**12 with _utgivningsbevis_ (journalistic exemption under YGL — shown first):**
Aftonbladet · Expressen · Dagens Nyheter · Svenska Dagbladet · Göteborgs-Posten · SVT · Sveriges Radio · TV4 · Bonnier News · Schibsted · MTG · Stampen

**14 general:**
Google · Meta · LinkedIn · Apple · Spotify · Amazon · Microsoft · TikTok · Klarna · Zalando · Blocket · Tradera · Hemnet · Swedbank

Companies with `utgivningsbevis: true` have legal protection for archived editorial content under YGL — but must still delete account, subscription and profile data on request.

---

## Database Schema

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | = `auth.users.id` |
| `full_name` | text | |
| `level` | int (1-3) | subscription level; default 1 |
| `created_at` | timestamptz | |

### `requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `company_id` | text | |
| `company_name` | text | |
| `user_email` | text | email used in the GDPR request |
| `user_name` | text | name used in the GDPR request |
| `status` | text | `pending` / `sent` / `confirmed` / `removed` / `failed` / `expired` |
| `sent_at` | timestamptz | |
| `response_at` | timestamptz | |
| `created_at` | timestamptz | |

### `scans`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `scan_email` | text | |
| `breach_names` | text[] | |
| `breach_count` | int | |
| `created_at` | timestamptz | |

### `reminders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `request_id` | uuid FK → requests | |
| `remind_at` | timestamptz | |
| `sent` | boolean | |

### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | actor (may be admin or end-user) |
| `user_email` | text | |
| `action` | text | `admin_level_change` · `admin_delete` · `admin_export` · `scan_email` · `send_request` |
| `resource` | text | affected entity |
| `metadata` | jsonb | action-specific data |
| `created_at` | timestamptz | |

### `admin_deletions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `deleted_user_id` | uuid | |
| `deleted_user_email` | text | |
| `deleted_by_email` | text | admin who triggered the deletion |
| `created_at` | timestamptz | |

All tables use Row Level Security (RLS). Users can only read/write their own rows. Admin functions bypass RLS via the service-role key in edge functions.

---

## Database Migrations

| File | What it does |
|------|-------------|
| `001_initial_schema.sql` | Profiles, requests, scans, RLS policies |
| `002_add_scan_columns.sql` | Add `breach_names[]` and `breach_count` to scans |
| `003_schedule_reminders.sql` | Add reminders table + pg_cron schedule |
| `004_admin.sql` | Admin role, audit_logs, admin_deletions, aggregate RPCs |
| `005_optimize_admin.sql` | Fix audit_logs RLS DoS vector; add `admin_request_counts()` + `admin_scan_counts()` |
| `006_admin_stats.sql` | 7 analytics RPCs: signups/requests/scans per day, top companies, request statuses, breach stats, active+stale counts, response times |
| `007_weekly_digest_cron.sql` | pg_cron schedule — calls `admin-weekly-digest` every Monday 07:00 UTC via pg_net, reads `DIGEST_SECRET` from Supabase Vault |

All migrations run via Supabase CLI (autonomous — no manual steps):
```bash
supabase db query --linked -f "supabase/migrations/<file>.sql"
```

---

## Edge Functions

### `scan-email`
Checks an email address for known data breaches.
- **Input:** `{ "email": "user@example.com" }`
- **Output:** `{ "breaches": [{...}] }`
- Uses XposedOrNot API — free, no key. Returns empty array on 404. 10 s timeout.

### `send-request`
Sends a GDPR Article 17 deletion request email to a company.
- **Input:** `{ companyName, gdprEmail, userName, userEmail, lang }`
- **Output:** `{ "success": true, "id": "resend-id" }`
- Uses Resend. Input-validated. CORS restricted to `bliglömd.se` + localhost.

### `send-reminders`
Daily cron (09:00 UTC). Finds opt-out requests with annual protection that are nearing expiry and sends renewal reminder emails to the user.

### `delete-account`
User-initiated: deletes the authenticated user's own account and all their data.

### `admin-list-users`
Returns all users with request/scan counts via aggregate RPCs (no full table scan).

### `admin-update-user`
Changes a user's subscription level (1-3). Writes to audit_logs.

### `admin-delete-user`
Permanently deletes a user (auth + DB rows). Sends a deletion report email to the admin. Writes to audit_logs and admin_deletions. Deletion happens **before** email so email failure never leaves a ghost record.

### `admin-export-user`
Exports all data for a user as a JSON blob. Used for GDPR Article 20 (data portability). Writes to audit_logs.

### `admin-stats`
9 parallel queries (listUsers + 8 RPCs). Returns a full analytics envelope:
- **Snapshot:** DAU/WAU/MAU, retention %, signups this/last week, requests this/last week, active/stale counts, avg requests per user, breach rate %
- **Time series:** signups/requests/scans per day (30 days)
- **Rankings:** top companies, request status breakdown, response times

### `admin-weekly-digest`
Called every Monday 07:00 UTC by pg_cron. Builds and sends an HTML report email to `ThorstenGrund@icloud.com` with:
- Week-over-week trends (signups, requests, retention, active/stale)
- Stale-request warning if any requests > 30 days old
- Top 5 companies, breach stats
- Verified via `DIGEST_SECRET` in Authorization header

---

## Admin Panel

Route: `/xadm` — accessible only to users with `user_metadata.role === 'admin'`.

Tabs:
- **Översikt** — 4 stat cards + level distribution + recent deletions
- **Användare** — searchable/filterable user table; user detail slide-in with level selector, export, and delete
- **Granskningslogg** — full audit event table (last 200 events)
- **Statistik** — full analytics dashboard:
  - 8 KPI cards (users: total/MAU/WAU/DAU/retention/new-this-week; requests: this-week trend, active count, avg/user, breach rate)
  - 2 SVG bar charts — signups and requests per day (30-day window)
  - Top companies horizontal bar chart
  - Request status stacked bar
  - Response times table (fastest-responding companies)
  - Stale-request alert banner
  - Auto-refreshes every 5 minutes

Session auto-logout after 30 minutes of inactivity (countdown timer in sidebar).

---

## Self-Maintaining Features

The service is designed to run with zero manual intervention:

| Feature | Trigger | What it does |
|---------|---------|-------------|
| Renewal reminders | Daily 09:00 UTC (pg_cron) | Emails users whose opt-out protection expires in ~1 month |
| Admin analytics auto-refresh | Every 5 min (browser timer) | Keeps analytics tab current without page reload |
| Weekly digest | Mondays 07:00 UTC (pg_cron) | Emails admin with KPIs, trends, stale-request alert |
| Session auto-logout | 30-min countdown | Prevents unauthorized access to admin panel |
| GitHub Actions CI/CD | Push to `main` | Builds and deploys frontend automatically |

---

## Security

- **RLS everywhere** — users can only access their own rows; service-role key never exposed to browser
- **CORS restricted** — edge functions only accept requests from `bliglömd.se` and `localhost`
- **Admin role-check** — both client-side (`user_metadata.role`) and server-side (edge function verifies JWT claims)
- **No secrets in git** — `RESEND_API_KEY` and `DIGEST_SECRET` are Supabase Edge Function Secrets; `DIGEST_SECRET` is also in Supabase Vault for pg_cron access
- **HTML-escaped email content** — admin deletion report escapes all user-supplied data before inserting into HTML
- **Audit log** — every admin action is recorded with actor, target, and metadata

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/ThorstenGru/bliglomd.git
cd bliglomd

# 2. Install
npm install

# 3. Environment
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Run
npm run dev
# → http://localhost:5173
```

Edge function secrets (`RESEND_API_KEY`, `DIGEST_SECRET`) are only needed for functions that use them — local dev with mock data works without them.

---

## Deployment

### GitHub Actions (automatic — runs on every push to `main`)

The workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. Installs Node 20 + `npm ci`
2. Runs `npm run build` with secrets injected as env vars
3. Uploads `dist/` as a Pages artifact
4. Deploys to GitHub Pages

**Required GitHub Secrets** (Settings → Secrets → Actions):
```
VITE_SUPABASE_URL       = https://ydkahdqvuykpmjkpunck.supabase.co
VITE_SUPABASE_ANON_KEY  = <publishable anon key>
```

**GitHub Pages settings** (Settings → Pages):
- Source: **GitHub Actions**
- Custom domain: `bliglömd.se`

### Edge Functions (CLI — run after any function change)

```bash
supabase link --project-ref ydkahdqvuykpmjkpunck
supabase functions deploy <function-name>
```

### Database Migrations (autonomous via CLI)

```bash
supabase db query --linked -f "supabase/migrations/<file>.sql"
```

---

## Custom Domain

| Setting | Value |
|---------|-------|
| Domain | `bliglömd.se` (punycode: `xn--bliglmd-e1a.se`) |
| DNS provider | Strato.se |
| TLS | Let's Encrypt (GitHub Pages managed) |
| CNAME file | `public/CNAME` → `bliglömd.se` |

SPA routing on GitHub Pages is handled by `public/404.html` (saves path to `sessionStorage`) + `index.html` (restores the path before React mounts).

---

## Environment Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | GitHub Secrets + `.env.local` | Safe to expose — public URL |
| `VITE_SUPABASE_ANON_KEY` | GitHub Secrets + `.env.local` | Safe to expose — RLS protects data |
| `RESEND_API_KEY` | Supabase Edge Function Secrets | **Never in git or GitHub Secrets** |
| `DIGEST_SECRET` | Supabase Edge Function Secrets + Vault | **Never in git** — Vault allows pg_cron access |

---

## Project Structure

```
.github/
└── workflows/deploy.yml       CI/CD — build + deploy to GitHub Pages

public/
├── 404.html                   SPA fallback for GitHub Pages routing
├── CNAME                      Custom domain: bliglömd.se
└── favicon.svg

src/
├── components/
│   ├── AuthModal.tsx           Login/signup modal
│   ├── BrandLogo.tsx           Logo component
│   ├── CompanyCard.tsx         Company card with level badges
│   ├── LevelBadge.tsx          L1/L2/L3 colored badge
│   ├── NavBar.tsx              Sticky nav + language toggle
│   ├── RequestTypeBadge.tsx    Request type indicator
│   └── StatusBadge.tsx         Request status badge
├── contexts/
│   └── LanguageContext.tsx     Global SV/EN context (localStorage)
├── data/
│   └── companies.ts            26 companies; COMPANIES_SORTED (utgivningsbevis first)
├── lib/
│   ├── i18n.ts                 All SV/EN translations
│   └── supabase.ts             Supabase client init
├── pages/
│   ├── Admin.tsx               Admin panel (overview · users · audit · analytics)
│   ├── Dashboard.tsx           My requests table
│   ├── Home.tsx                Landing page + testimonial carousel
│   ├── Profile.tsx             User profile
│   ├── Request.tsx             L1/L2/L3 request flow
│   ├── Scan.tsx                Breach scan + company list
│   └── Status.tsx              Real-time system health
└── types/
    └── index.ts                Company, Request, Scan, RequestStatus types

supabase/
├── functions/
│   ├── admin-delete-user/      Admin: delete user + audit email
│   ├── admin-export-user/      Admin: GDPR data export
│   ├── admin-list-users/       Admin: user list with counts
│   ├── admin-stats/            Admin: full analytics endpoint
│   ├── admin-update-user/      Admin: change subscription level
│   ├── admin-weekly-digest/    Cron: weekly report to admin
│   ├── delete-account/         User: self-deletion
│   ├── scan-email/             Breach check via XposedOrNot
│   ├── send-reminders/         Cron: renewal reminder emails
│   └── send-request/           GDPR deletion email via Resend
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_add_scan_columns.sql
    ├── 003_schedule_reminders.sql
    ├── 004_admin.sql
    ├── 005_optimize_admin.sql
    ├── 006_admin_stats.sql
    └── 007_weekly_digest_cron.sql
```

---

## License

© 2026 Thorsten Grund. All rights reserved.
