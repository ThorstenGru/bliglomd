# BliGlömd — GDPR Raderingsförfrågningar

Copyright (c) 2026 Thorsten Grund. All rights reserved.

## Om tjänsten
BliGlömd hjälper privatpersoner att utöva sin rätt enligt GDPR Artikel 17
(rätten till radering) genom att automatisera raderingsförfrågningar till företag.

## Tre nivåer
- L1 Hitta — Identifiera var du förekommer + guidade instruktioner (Gratis)
- L2 Skicka — Genererar och skickar GDPR-mail åt dig (Plus)
- L3 Bevaka — Spårar svar och bekräftar radering (Pro)

## Tech stack
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Supabase (Auth + PostgreSQL + Edge Functions)
- Mail: Resend.com
- Deploy: GitHub Pages
- CI/CD: GitHub Actions

## Lokal utveckling
```bash
npm install
cp .env.example .env.local
# Fyll i .env.local med dina Supabase-nycklar
npm run dev
```

## Deploy
Push till main → GitHub Actions bygger och deployer automatiskt.

Live: https://thorstengru.github.io/bliglomd/
