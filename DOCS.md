# BliGlömd — Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [GitHub & GitHub Pages Configuration](#github--github-pages-configuration)
3. [Supabase Configuration](#supabase-configuration)
4. [Edge Functions](#edge-functions)
5. [Database Schema](#database-schema)
6. [DNS & Custom Domain](#dns--custom-domain)
7. [Environment Variables & Secrets](#environment-variables--secrets)
8. [Adding Companies](#adding-companies)
9. [Routing](#routing)

---

## Architecture Overview

```
User browser
    │
    ▼
bliglömd.se  (GitHub Pages, CDN)
    │  React SPA (static files)
    │
    ├──► Supabase Auth          (login / signup)
    ├──► Supabase PostgreSQL    (requests, profiles, scans)
    ├──► Edge Function: scan-email   → XposedOrNot API
    └──► Edge Function: send-request → Resend API → Company GDPR inbox
```

All backend logic lives in Supabase. The frontend is a fully static build deployed to GitHub Pages — no Node.js server in production.

---

## GitHub & GitHub Pages Configuration

### Repo
- URL: `https://github.com/ThorstenGru/bliglomd`
- Visibility: Public
- Default branch: `main`
- Secret scanning: enabled
- Push protection: enabled

### GitHub Pages
| Setting | Value |
|---------|-------|
| Source | GitHub Actions (`build_type: workflow`) |
| Custom domain | `xn--bliglmd-e1a.se` (bliglömd.se) |
| HTTPS enforced | auto-enables after TLS cert issued |
| CNAME file | `public/CNAME` → persists through every deploy |

### GitHub Actions workflow (`.github/workflows/deploy.yml`)
Triggers on: push to `main`, manual `workflow_dispatch`

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20)
3. `npm install`
4. `npm run build` (injects secrets as env vars)
5. `actions/upload-pages-artifact@v3` (uploads `dist/`)
6. `actions/deploy-pages@v4` (deploys to Pages)

### GitHub Secrets
| Secret | Used in |
|--------|---------|
| `VITE_SUPABASE_URL` | Build step → baked into JS bundle |
| `VITE_SUPABASE_ANON_KEY` | Build step → baked into JS bundle |

> Note: `npm install` is used instead of `npm ci` because there is no `package-lock.json`
> (Node.js is not installed locally; all builds happen in CI).

---

## Supabase Configuration

- **Project ref:** `ydkahdqvuykpmjkpunck`
- **URL:** `https://ydkahdqvuykpmjkpunck.supabase.co`
- **Region:** eu-west-1 (Ireland)

### Auth
Email + password auth enabled. On successful login/signup, user is redirected to `/scan`.

User metadata stored in `profiles` table via database trigger on `auth.users`.

### Edge Function Secrets (set via Supabase Dashboard → Edge Functions → Secrets)
| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Send transactional email via Resend |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS in Edge Functions |

---

## Edge Functions

### `scan-email`
Path: `supabase/functions/scan-email/index.ts`

Checks an email address against the XposedOrNot breach database.

**Request:**
```json
{ "email": "user@example.com" }
```

**Response:**
```json
{
  "breaches": [
    {
      "breach": "ExampleBreach",
      "xposed_date": "2023-01-15",
      "domain": "example.com",
      "industry": "Technology",
      "xposed_data": "Emails, Passwords",
      "xposed_records": 1200000
    }
  ]
}
```

Uses `https://api.xposedornot.com/v1/breach-analytics?email=<email>` — no API key required.
Returns empty array `[]` if no breaches found (404 from XposedOrNot).

### `send-request`
Path: `supabase/functions/send-request/index.ts`

Sends a GDPR Article 17 deletion email to a company on behalf of the user.

**Request:**
```json
{
  "companyName": "Google",
  "gdprEmail": "privacy@google.com",
  "userName": "Anna Svensson",
  "userEmail": "anna@example.com"
}
```

Sends via Resend from `BliGlömd <noreply@bliglomd.se>`.
Mail template is a formal Swedish GDPR deletion request citing Article 17.

---

## Database Schema

All tables use Row Level Security. Users can only access their own rows.

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | FK → auth.users |
| full_name | text | |
| email | text | |
| created_at | timestamptz | |

### `requests`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| company_id | text | matches `companies.ts` id |
| company_name | text | |
| user_email | text | |
| user_name | text | |
| status | text | pending/sent/confirmed/removed/failed/expired |
| sent_at | timestamptz | |
| response_at | timestamptz | |
| created_at | timestamptz | |

### `scans`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| email | text | scanned email |
| breach_count | int | |
| breaches | jsonb | raw XposedOrNot response |
| created_at | timestamptz | |

### `reminders`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| request_id | uuid | FK → requests |
| user_id | uuid | FK → profiles |
| remind_at | timestamptz | |
| sent | boolean | |
| created_at | timestamptz | |

---

## DNS & Custom Domain

Domain: `bliglömd.se` (registered at Strato.se)
Punycode: `xn--bliglmd-e1a.se`

### DNS Records (configured at Strato.se)
| Type | Name | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| CNAME | www | thorstengru.github.io |

### How custom domain persists through deploys
`public/CNAME` contains `bliglömd.se`. Vite copies everything in `public/` to `dist/` on build, so the CNAME file is always present in the Pages deployment artifact. GitHub Pages reads it and maintains the custom domain mapping.

### Vite base path
`vite.config.ts` has `base: '/'` — required for custom domain root deployment.
(Was `/bliglomd/` when hosted as a subpath at `thorstengru.github.io/bliglomd/`.)

---

## Environment Variables & Secrets

| Variable | Where stored | Committed to git? |
|----------|-------------|-------------------|
| `VITE_SUPABASE_URL` | GitHub Secret + `.env.local` | No |
| `VITE_SUPABASE_ANON_KEY` | GitHub Secret + `.env.local` | No |
| `RESEND_API_KEY` | Supabase Edge Function Secret only | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function Secret only | No |

The anon key is safe to expose in client-side bundles — it's designed for public use and all data access is controlled by Row Level Security policies.

The service role key bypasses RLS and must **never** appear in frontend code, GitHub Secrets, or git history.

---

## Adding Companies

Edit `src/data/companies.ts`. Each entry:

```typescript
{
  id: 'unique-id',
  name: 'Company Name',
  category: 'Sociala medier',          // display category
  country: 'USA',
  gdpr_email: 'privacy@company.com',   // null if no email (use form instead)
  gdpr_url: 'https://company.com/privacy/delete',
  instructions_sv: 'Gå till Inställningar → ...',
  level1_available: true,
  level2_available: true,
  level3_available: true,              // false if no gdpr_email
}
```

No backend changes needed — companies are static data in the frontend bundle.

---

## Routing

React Router DOM v6 with `BrowserRouter` (no `basename`).

| Path | Component | Auth required |
|------|-----------|---------------|
| `/` | Home | No |
| `/scan` | Scan | Yes |
| `/request/:id` | Request | Yes |
| `/dashboard` | Dashboard | Yes |
| `/status` | Status | No |
| `*` | → redirect `/` | — |

Auth is enforced by the `AuthGuard` wrapper in `App.tsx`. Unauthenticated users see a login prompt in-place rather than being redirected.
