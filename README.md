# BliGlömd — GDPR Deletion Request Tool

Live: **[bliglömd.se](https://xn--bliglmd-e1a.se)**

BliGlömd helps Swedish internet users exercise their right to erasure under GDPR Article 17. It scans your email address for known data breaches and generates ready-to-send deletion requests for companies that hold your personal data — with a focus on Swedish companies that hold a publishing certificate (_utgivningsbevis_) under YGL.

---

## Features

| Level | What it does |
|-------|-------------|
| **L1 — Find** | Guided instructions for each company's GDPR portal |
| **L2 — Send** | Ready-made, legally correct email template to copy-paste |
| **L3 — Monitor** | BliGlömd sends the email and records the status |

- **Bilingual** — full Swedish/English UI, persisted per user in localStorage
- **Breach scan** — powered by [XposedOrNot](https://xposedornot.com) (free, no API key)
- **Utgivningsbevis focus** — Swedish media companies (Aftonbladet, Expressen, DN, SvD, GP, SVT, SR, TV4…) shown first, with note about journalistic exemption
- **Dashboard** — track request status (pending → sent → confirmed → removed)
- **System status** page at `/status` — real-time health of all components

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Auth & DB | Supabase (PostgreSQL + RLS) |
| Email | Resend.com (via Supabase Edge Function) |
| Hosting | GitHub Pages with custom domain |
| CI/CD | GitHub Actions |

---

## Company Coverage

26 companies currently in the database. **12 with utgivningsbevis** (shown first):

Aftonbladet · Expressen · Dagens Nyheter · Svenska Dagbladet · Göteborgs-Posten · SVT · Sveriges Radio · TV4 · Bonnier News · Schibsted · MTG · Stampen

Plus: Google · Meta · LinkedIn · Apple · Spotify · Amazon · Microsoft · TikTok · Klarna · Zalando · Blocket · Tradera · Hemnet · Swedbank

---

## Environment Variables

Set in GitHub Secrets and injected at build time:

```
VITE_SUPABASE_URL=https://ydkahdqvuykpmjkpunck.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Edge Function secret (set in Supabase Dashboard > Edge Functions > Secrets):

```
RESEND_API_KEY=re_...  ← NEVER commit this
```

> **Security**: Never commit `.env.local`. Never put `RESEND_API_KEY` or the service role key in GitHub Secrets or source code.

---

## Local Development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

---

## Deploy

Push to `main` — GitHub Actions builds and deploys to GitHub Pages automatically.

### Edge Functions (manual deploy needed after changes)

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```bash
supabase login
supabase link --project-ref ydkahdqvuykpmjkpunck
supabase functions deploy scan-email
supabase functions deploy send-request
```

### Database Migrations

Apply via Supabase Dashboard → SQL Editor, or:

```bash
supabase db push
```

---

## Project Structure

```
src/
├── components/
│   ├── AuthModal.tsx      — login/signup modal
│   ├── CompanyCard.tsx    — company with level badges + utgivningsbevis badge
│   ├── LevelBadge.tsx     — L1/L2/L3 colored badge
│   ├── NavBar.tsx         — sticky top nav with language toggle
│   └── StatusBadge.tsx    — request status badge
├── contexts/
│   └── LanguageContext.tsx — global SV/EN context, persisted to localStorage
├── data/
│   └── companies.ts       — 26 companies; COMPANIES_SORTED (utgivningsbevis first)
├── lib/
│   ├── i18n.ts            — all SV/EN translations
│   └── supabase.ts        — client init with env-var guard
├── pages/
│   ├── Home.tsx           — landing page with hero + level cards
│   ├── Scan.tsx           — breach check + company list
│   ├── Request.tsx        — L1/L2/L3 request flow
│   ├── Dashboard.tsx      — my requests table
│   └── Status.tsx         — real-time system health
└── types/
    └── index.ts           — Company, Request, Scan, RequestStatus types

supabase/
├── functions/
│   ├── scan-email/        — breach check via XposedOrNot API
│   └── send-request/      — GDPR email via Resend
└── migrations/
    ├── 001_initial_schema.sql
    └── 002_add_scan_columns.sql
```

---

## License

© 2026 Thorsten Grund. All rights reserved.
