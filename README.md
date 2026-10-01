# BliGlömd — source repository

Source for the BliGlömd web app. Live site: [bliglömd.se](https://xn--bliglmd-e1a.se)

A React/Supabase single-page app that helps Swedish users identify which companies hold
their personal data and request its deletion under GDPR Article 17, with status tracking,
follow-up reminders, and a role-gated internal admin panel.

---

## Features

- **Breach scan** — powered by [XposedOrNot](https://xposedornot.com) (free, no key required)
- **Bilingual** — full Swedish/English UI, persisted per user in localStorage
- **Three internal tiers** — self-serve instructions, auto-generated request text, and send-on-behalf, gated by subscription level
- **Dashboard** — view and track all your requests (pending → sent → confirmed → removed)
- **Reminder emails** — automatic follow-up for opt-out sites with time-limited protection windows
- **System status page** — real-time health of all components
- **Internal admin panel** — role-gated; user management, audit log, analytics
- **Weekly digest** — automatic email to admin with key metrics

---

## Architecture

React SPA (GitHub Pages) → Supabase (Auth + Postgres + RLS) → a set of Supabase Edge
Functions for breach scanning, sending GDPR requests, reminders, and role-gated admin
operations. Scheduled jobs run via pg_cron. See `supabase/functions/` and
`supabase/migrations/` for the current list — intentionally not enumerated here.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript 5.8 · Vite 6 · Tailwind CSS 3 |
| Routing | React Router v6 |
| Auth & DB | Supabase (PostgreSQL 15 + RLS) |
| Edge Functions | Supabase Edge Functions (Deno runtime) |
| Email | Brevo.com |
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

## Database & Edge Functions

Schema, migrations, and edge function implementations live in `supabase/` — not
reproduced here. Summary: all tables use Row Level Security, users can only read/write
their own rows, and admin-only operations run through server-side edge functions that
verify JWT role claims independently of the client. See `supabase/migrations/` for schema
history and `supabase/functions/*/index.ts` for implementation details.

---

## Admin Panel

Internal, role-gated route (`user_metadata.role === 'admin'`) with user management, an
audit log, and an analytics dashboard. Session auto-logout after 30 minutes of
inactivity. Implementation in `src/pages/Admin.tsx`.

The service otherwise runs with minimal manual intervention: scheduled reminders and
digests via pg_cron, and automatic deploys via GitHub Actions on push to `main`.

---

## Security

- **RLS everywhere** — users can only access their own rows; service-role key never exposed to browser
- **CORS restricted** — edge functions only accept requests from `bliglömd.se` and `localhost`
- **Admin role-check** — both client-side (`user_metadata.role`) and server-side (edge function verifies JWT claims)
- **No secrets in git** — `BREVO_API_KEY` and `DIGEST_SECRET` are Supabase Edge Function Secrets; `DIGEST_SECRET` is also in Supabase Vault for pg_cron access
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

Edge function secrets (`BREVO_API_KEY`, `DIGEST_SECRET`) are only needed for functions that use them — local dev with mock data works without them.

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
| `BREVO_API_KEY` | Supabase Edge Function Secrets | **Never in git or GitHub Secrets** |
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
├── functions/      Edge functions — see supabase/functions/*/index.ts
└── migrations/      Schema history — see supabase/migrations/
```

---

## License

© 2026 Thorsten Grund. All rights reserved.
