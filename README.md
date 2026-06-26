# BliGlömd

**GDPR raderingsförfrågningar med ett klick.**

BliGlömd hjälper privatpersoner att utöva sin rätt enligt GDPR Artikel 17 — rätten till radering. Välj ett företag, välj nivå och skicka en juridiskt korrekt raderingsförfrågan på sekunder.

🌐 **Live:** [bliglömd.se](https://xn--bliglmd-e1a.se)
📊 **Status:** [bliglömd.se/status](https://xn--bliglmd-e1a.se/status)

---

## Funktioner

| Nivå | Namn | Vad det gör |
|------|------|-------------|
| L1 | **Hitta** | Guidade instruktioner + länk till varje företags GDPR-sida |
| L2 | **Skicka** | Färdig juridisk mailmall att kopiera och skicka själv |
| L3 | **Bevaka** | Vi skickar mailet åt dig och spårar svaret i din dashboard |

- Skärmar din e-post mot kända dataintrång (XposedOrNot)
- 20 förkonfigurerade företag (Google, Meta, Spotify, Klarna, Swish m.fl.)
- Realtids systemstatussida (SV/EN)
- Konto med e-post + lösenord via Supabase Auth

---

## Tech Stack

| Lager | Teknologi |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Auth & Databas | Supabase (PostgreSQL + Row Level Security) |
| Serverless | Supabase Edge Functions (Deno) |
| E-post | Resend API |
| Intrångskoll | XposedOrNot API (gratis, ingen nyckel krävs) |
| Hosting | GitHub Pages (via GitHub Actions) |
| Domän | bliglömd.se (Strato.se) |

---

## Repo-struktur

```
bliglomd/
├── public/
│   ├── CNAME                    # Custom domain för GitHub Pages
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── AuthModal.tsx        # Inloggning / registrering
│   │   ├── CompanyCard.tsx      # Företagskort i skärmlistan
│   │   ├── LevelBadge.tsx       # L1/L2/L3-badge
│   │   └── StatusBadge.tsx      # Förfrågningsstatus-badge
│   ├── data/
│   │   └── companies.ts         # 20 företag med GDPR-kontakter
│   ├── lib/
│   │   └── supabase.ts          # Supabase-klient
│   ├── pages/
│   │   ├── Home.tsx             # Landningssida
│   │   ├── Scan.tsx             # E-postsökning + intrångskoll
│   │   ├── Request.tsx          # Skicka förfrågan (L1/L2/L3)
│   │   ├── Dashboard.tsx        # Mina förfrågningar
│   │   └── Status.tsx           # Systemstatussida (SV/EN)
│   ├── types/
│   │   └── index.ts
│   └── App.tsx                  # Router + AuthGuard
├── supabase/
│   ├── functions/
│   │   ├── scan-email/          # Intrångskontroll via XposedOrNot
│   │   └── send-request/        # Skickar GDPR-mail via Resend
│   └── migrations/
│       └── 001_initial_schema.sql
├── .github/
│   └── workflows/
│       └── deploy.yml           # Build + deploy till GitHub Pages
├── vite.config.ts
└── tailwind.config.js
```

---

## Lokalt utvecklingsläge

Du behöver Node.js 20+.

```bash
git clone https://github.com/ThorstenGru/bliglomd.git
cd bliglomd
npm install
```

Skapa `.env.local`:
```
VITE_SUPABASE_URL=https://<din-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<din-anon-nyckel>
```

```bash
npm run dev
```

---

## Deployment

Varje push till `main` triggar GitHub Actions som automatiskt:
1. Bygger projektet med Vite
2. Deployar `dist/` till GitHub Pages

**GitHub Secrets som krävs:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Säkerhet

- `RESEND_API_KEY` lagras **endast** i Supabase Edge Function Secrets — aldrig i kod eller git
- `.env.local` är gitignorerad
- Service role key används aldrig i frontend eller GitHub Secrets
- Alla Supabase-tabeller skyddas av Row Level Security (RLS)
- GitHub secret scanning är aktiverat

---

© 2026 Thorsten Grund. All rights reserved.
