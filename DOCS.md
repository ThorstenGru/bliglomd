# BliGlömd — Technical Documentation

## Architecture

```
Browser
  └─ React SPA (GitHub Pages / bliglömd.se)
        ├─ Supabase Auth (JWT sessions)
        ├─ Supabase DB (PostgreSQL + RLS)
        ├─ Edge Function: scan-email  ──► XposedOrNot API
        └─ Edge Function: send-request ──► Resend API ──► Company GDPR email
```

---

## Routing

All routes are client-side (React Router v6, `BrowserRouter` at root `/`).

| Path | Component | Auth required |
|------|-----------|---------------|
| `/` | `Home` | No |
| `/scan` | `Scan` | Yes |
| `/request/:id` | `Request` | Yes |
| `/dashboard` | `Dashboard` | Yes |
| `/status` | `Status` | No |

GitHub Pages SPA routing is handled by:
- `public/404.html` — saves `location.href` to `sessionStorage.redirect`, redirects to `/`
- `index.html` — restores the path from `sessionStorage.redirect` before React mounts

---

## Internationalisation

All UI strings live in [`src/lib/i18n.ts`](src/lib/i18n.ts) as a nested `translations` object with `sv` and `en` keys. The active language is stored in `localStorage('bliglomd-lang')` and exposed via `useLang()` from `src/contexts/LanguageContext.tsx`.

```tsx
const { t, lang, setLang, toggleLang } = useLang()
```

**Adding a new translation key:**
1. Add the key to both `translations.sv` and `translations.en` in `i18n.ts`
2. TypeScript will show an error in any component trying to use it until both sides are present

---

## Company Data

[`src/data/companies.ts`](src/data/companies.ts) contains 26 companies as `Company[]`.

`COMPANIES_SORTED` — utgivningsbevis companies first, then others.

### Company shape

```ts
interface Company {
  id: string
  name: string
  category: string
  country: string
  gdpr_email: string | null       // null → no L3 available
  gdpr_url: string
  instructions_sv: string
  instructions_en: string
  level1_available: boolean
  level2_available: boolean
  level3_available: boolean       // always false when gdpr_email is null
  utgivningsbevis: boolean        // Swedish publishing certificate (YGL)
}
```

### Utgivningsbevis rule

Companies with `utgivningsbevis: true` have legal protection for editorially published content under YGL (Yttrandefrihetsgrundlagen). They **must** still delete account/subscription/profile data on request; they may only refuse erasure of content in their journalistic archive.

---

## Request Levels

| Level | Method | Tracked |
|-------|--------|---------|
| L1 — Find | User reads instructions, visits company's GDPR portal | No |
| L2 — Send | User copies the generated email template and sends it manually | No |
| L3 — Monitor | BliGlömd sends the email via Resend + inserts a `requests` row | Yes |

---

## Database Schema

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | = auth.users.id |
| `full_name` | text | |
| `created_at` | timestamptz | |

### `requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → profiles) | |
| `company_id` | text | |
| `company_name` | text | |
| `user_email` | text | email used in the request |
| `user_name` | text | name used in the request |
| `status` | text | pending / sent / confirmed / removed / failed / expired |
| `sent_at` | timestamptz | |
| `response_at` | timestamptz | |
| `created_at` | timestamptz | |

### `scans`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → profiles) | |
| `scan_email` | text | |
| `breach_names` | text[] | added in migration 002 |
| `breach_count` | int | added in migration 002 |
| `created_at` | timestamptz | |

> `hibp_breaches` and `category_suggestions` (jsonb) are legacy columns from migration 001 and are no longer written to.

### `reminders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `request_id` | uuid (FK → requests) | |
| `remind_at` | timestamptz | |
| `sent` | boolean | |

All tables use Row Level Security (RLS). Users can only read/write their own rows.

---

## Edge Functions

### `scan-email`

**Endpoint:** `POST /functions/v1/scan-email`  
**Auth:** Supabase anon key (Bearer token)  
**Input:** `{ "email": "user@example.com" }`  
**Output:** `{ "breaches": [{ breach, xposed_date, domain, xposed_data, xposed_records }] }`

Calls [XposedOrNot](https://xposedornot.com/api_doc) — free, no API key needed. Returns empty array on 404 (no breaches). 10-second timeout. Input-validates email format.

### `send-request`

**Endpoint:** `POST /functions/v1/send-request`  
**Auth:** Supabase anon key (Bearer token)  
**CORS:** Restricted to `xn--bliglmd-e1a.se` and `localhost`  
**Input:**
```json
{
  "companyName": "Aftonbladet",
  "gdprEmail": "integritet@aftonbladet.se",
  "userName": "Anna Svensson",
  "userEmail": "anna@example.com"
}
```
**Output:** `{ "success": true, "id": "resend-message-id" }`

Sends via [Resend](https://resend.com). Requires `RESEND_API_KEY` secret. Validates all inputs. Restricted CORS. 15-second timeout.

---

## CI/CD

`.github/workflows/deploy.yml`:
1. Checkout → `npm install` → `npm run build` (injects `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from GitHub Secrets)
2. Upload artifact → Deploy to GitHub Pages

Edge functions are **not** deployed via CI — deploy manually with the Supabase CLI or via the Dashboard.

---

## Custom Domain

Domain: `bliglömd.se` (punycode: `xn--bliglmd-e1a.se`)  
DNS: Strato.se  
TLS: Let's Encrypt (issued 26 Jun 2026)  

DNS records required:
```
A     @  185.199.108.153
A     @  185.199.109.153
A     @  185.199.110.153
A     @  185.199.111.153
AAAA  @  2606:50c0:8000::153  (+ 8001, 8002, 8003)
CNAME www  thorstengru.github.io
```

`public/CNAME` contains `bliglömd.se` and is deployed on every Actions run to preserve the custom domain.

---

## Supabase Auth Configuration

| Setting | Value |
|---------|-------|
| Site URL | `https://xn--bliglmd-e1a.se` |
| Redirect URLs | `https://xn--bliglmd-e1a.se/**` |
| Email confirmations | Enabled |

---

## Pending / Future Work

- [ ] Apply DB migration 002 (add `breach_names` / `breach_count` to `scans` table)
- [ ] Deploy updated edge functions via Supabase CLI
- [ ] Add more companies (EU market expansion)
- [ ] Implement reminder emails (30-day follow-up)
- [ ] Add L2/L3 for companies currently L1-only
- [ ] User profile page (manage email, delete account)
