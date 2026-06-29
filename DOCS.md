# BliGlömd — Technical Documentation

## Architecture

```
Browser
  └─ React SPA (GitHub Pages / bliglömd.se)
        ├─ Supabase Auth (JWT sessions)
        ├─ Supabase DB (PostgreSQL + RLS)
        ├─ Edge Function: scan-email        ──► XposedOrNot API
        ├─ Edge Function: send-request      ──► Resend API ──► company GDPR email
        ├─ Edge Function: send-reminders    ──► Resend API ──► user renewal reminder
        ├─ Edge Function: delete-account    ──► deletes own account
        ├─ Edge Function: admin-list-users  ──► user list + counts
        ├─ Edge Function: admin-update-user ──► change level + audit
        ├─ Edge Function: admin-delete-user ──► delete user + audit email
        ├─ Edge Function: admin-export-user ──► GDPR data export JSON
        ├─ Edge Function: admin-stats       ──► analytics snapshot
        └─ Edge Function: admin-weekly-digest ──► weekly HTML email

pg_cron (PostgreSQL scheduler):
  ├─ send-reminders        daily 09:00 UTC
  └─ admin-weekly-digest   Mondays 07:00 UTC (calls via pg_net; secret from Vault)
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
| `/profile` | `Profile` | Yes |
| `/xadm` | `Admin` | Yes + admin role |

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
2. TypeScript will error in any component trying to use it until both sides are present

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
  gdpr_email: string | null       // null → Ghost tier unavailable
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

Companies with `utgivningsbevis: true` have legal protection for editorially published content under YGL. They **must** still delete account/subscription/profile data on request; they may only refuse erasure of content in their journalistic archive.

---

## Subscription Tiers

| Tier | Method | Tracked |
|------|--------|---------|
| **Trace** (free) | User reads instructions, visits company's GDPR portal | No |
| **Cipher** (paid) | User copies the generated email template and sends it manually | No |
| **Ghost** (paid) | BliGlömd sends the email via Resend + inserts a `requests` row | Yes |

---

## Database Schema

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | = auth.users.id |
| `full_name` | text | |
| `level` | int | 1 (Trace) / 2 (Cipher) / 3 (Ghost); set by admin or Stripe webhook |
| `created_at` | timestamptz | |

### `requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
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
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `scan_email` | text | |
| `breach_names` | text[] | migration 002 |
| `breach_count` | int | migration 002 |
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
| `user_id` | uuid | actor |
| `user_email` | text | |
| `action` | text | admin_level_change / admin_delete / admin_export / scan_email / send_request |
| `resource` | text | affected entity ID |
| `metadata` | jsonb | action-specific data |
| `created_at` | timestamptz | |

RLS: users can INSERT own events; admins query via service-role (bypasses RLS).

### `admin_deletions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `deleted_user_id` | uuid | |
| `deleted_user_email` | text | |
| `deleted_by_email` | text | |
| `created_at` | timestamptz | |

---

## Edge Functions

### `scan-email`
**Endpoint:** `POST /functions/v1/scan-email`
**Input:** `{ "email": "user@example.com" }`
**Output:** `{ "breaches": [{ breach, xposed_date, domain, xposed_data, xposed_records }] }`

Calls XposedOrNot API (free). Returns empty array on 404. 10 s timeout. Validates email format.

### `send-request`
**Endpoint:** `POST /functions/v1/send-request`
**CORS:** Restricted to `xn--bliglmd-e1a.se` and `localhost`
**Input:** `{ companyName, gdprEmail, userName, userEmail, lang }`
**Output:** `{ "success": true, "id": "resend-message-id" }`

Generates bilingual GDPR Article 17 email. Requires `RESEND_API_KEY` secret. Input-validated. 15 s timeout.

### `send-reminders`
Runs daily 09:00 UTC via pg_cron. For each company in `REMINDER_COMPANIES`, finds `status=sent` requests created 11+ months ago and emails the user a renewal reminder, then marks the request `expired`.

### `delete-account`
User-initiated. Deletes the authenticated user's auth record and all PostgreSQL rows. Uses service-role key to bypass RLS.

### `admin-list-users`
Returns all auth users merged with profile data (level, name) and per-user request/scan counts from `admin_request_counts()` and `admin_scan_counts()` aggregate RPCs.

### `admin-update-user`
Updates `profiles.level` for a given user. Writes an `admin_level_change` event to `audit_logs`.

### `admin-delete-user`
1. Validates admin JWT
2. Fetches user data for the audit record
3. Deletes the auth user (cascades to all rows)
4. Inserts into `admin_deletions`
5. Sends HTML deletion report to admin via Resend
6. Logs `admin_delete` to `audit_logs`

User data is HTML-escaped before insertion into the email template.

### `admin-export-user`
Returns a JSON blob with all data for a given user_id (auth record + profile + requests + scans). Returns 404 if user not found. Logs `admin_export` to `audit_logs`.

### `admin-stats`
9 parallel queries:
```
Promise.all([
  auth.admin.listUsers({ perPage: 1000 }),
  rpc('admin_signups_per_day'),
  rpc('admin_requests_per_day'),
  rpc('admin_scans_per_day'),
  rpc('admin_top_companies'),
  rpc('admin_request_statuses'),
  rpc('admin_breach_stats'),
  rpc('admin_active_and_stale'),
  rpc('admin_response_times'),
])
```
DAU/WAU/MAU and signup trends computed client-side from `listUsers` result. Returns a single JSON envelope with snapshot + time series + rankings.

### `admin-weekly-digest`
Checks `Authorization: Bearer <DIGEST_SECRET>` (soft — skipped if secret not set in env).
Queries 6 parallel RPCs + listUsers. Builds and sends an HTML email report to `ThorstenGrund@icloud.com` via Resend. Called by pg_cron every Monday 07:00 UTC; the cron job retrieves the secret from Supabase Vault at runtime.

---

## Admin Panel (`/xadm`)

Access is gated by `user.user_metadata.role === 'admin'`.

### Tabs

**Översikt**
- 4 stat cards: total users, total requests, total scans, deletion count
- Tier distribution (Trace/Cipher/Ghost with %)
- Recent deletions table

**Användare**
- Searchable + filterable user table (email, name, level, request/scan counts, dates)
- Click row → slide-in panel with: level selector, export JSON button, delete button
- Delete requires typing the user's email to confirm
- Actions write to audit_logs and show inline notice

**Granskningslogg**
- Table of last 200 audit events (timestamp, actor, action badge, resource)

**Statistik** (auto-refreshes every 5 min)
- Row 1 (Users): total, MAU/WAU/DAU, retention %, new this week
- Row 2 (Requests): this-week count, active, avg/user, breach rate %
- 2 SVG bar charts: daily signups + daily requests (30-day window)
- Top companies (horizontal bars)
- Request status breakdown (stacked bar + legend)
- Response times table (fastest-responding companies, min 2 confirmations)
- Yellow stale-request alert if any requests > 30 days without response

### Session

30-minute auto-logout countdown visible in sidebar. At 0, calls `supabase.auth.signOut()` and redirects to `/`.

---

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main`:
1. `npm ci` — reproducible install
2. `npm run build` — Vite build with Supabase env vars from GitHub Secrets
3. Upload `dist/` as Pages artifact
4. Deploy to GitHub Pages

**GitHub Secrets required:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Custom Domain

Domain: `bliglömd.se` (punycode: `xn--bliglmd-e1a.se`)
DNS: Strato.se
TLS: Let's Encrypt (issued 26 Jun 2026, managed by GitHub Pages)

DNS records:
```
A     @  185.199.108.153
A     @  185.199.109.153
A     @  185.199.110.153
A     @  185.199.111.153
AAAA  @  2606:50c0:8000::153  (+ 8001, 8002, 8003)
CNAME www  thorstengru.github.io
```

`public/CNAME` contains `bliglömd.se` and is deployed on every Actions run.

---

## Supabase Auth Configuration

| Setting | Value |
|---------|-------|
| Site URL | `https://xn--bliglmd-e1a.se` |
| Redirect URLs | `https://xn--bliglmd-e1a.se/**` |
| Email confirmations | Enabled |

---

## Security Model

| Concern | Mitigation |
|---------|-----------|
| Anon key exposure | Acceptable — RLS policies prevent cross-user access |
| Service role key | Only used server-side in edge functions; never in frontend code or GitHub Secrets |
| RESEND_API_KEY | Supabase Edge Function Secret only; never in git |
| DIGEST_SECRET | Supabase Edge Function Secret + Vault; never in git |
| Admin access | JWT role claim (`user_metadata.role === 'admin'`) verified in every admin edge function |
| Audit log DoS | `audit_logs` INSERT policy requires `auth.uid() = user_id AND uid IS NOT NULL` |
| HTML injection | All user-supplied data HTML-escaped before insertion into email templates |
| CORS | Edge functions restrict to known origins |

---

## Supabase CLI Cheatsheet

```bash
# Link project (only needed once per machine)
supabase link --project-ref ydkahdqvuykpmjkpunck --yes

# Run a migration
supabase db query --linked -f "supabase/migrations/<file>.sql"

# Deploy an edge function
supabase functions deploy <function-name>

# Set an edge function secret
supabase secrets set KEY=value

# Store a secret in Vault (run once; never commit the value)
supabase db query --linked "select vault.create_secret('value', 'name', 'description');"
```
