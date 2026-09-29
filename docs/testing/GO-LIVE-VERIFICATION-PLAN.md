# BliGlömd — Golden Go-Live Verification Plan

**Version:** 2026-09-29-v1
**Prepared for:** Thorsten Grund (founder)
**Scope:** Every user-facing flow, every backend component, the full payment/upgrade journey, admin operations, legal/compliance surfaces, infra, and a live-mode financial sign-off gate.
**Status at time of writing:** BliGlömd went live on Stripe **today** (2026-09-29), after a first live attempt (`2d9b2be`) was found misconfigured and reverted (`5cac5d0`), then rebuilt with fresh Cipher/Ghost products and a new webhook (`de491ba`), followed by cleanup commits (`5d66481`, `4579863`, `e72075b`). This plan exists specifically to be the final, exhaustive check before real customers rely on it in live mode.

---

## 0. How to use this document

- Work top to bottom. Each check has a **checkbox**, an **expected result**, and space to note actual result / defect.
- `[ME]` = Thorsten must personally perform this step (real money, real credentials, or a device/account only he controls).
- `[CLAUDE]` = Claude can drive this via browser/CLI/API on request.
- `[EITHER]` = either of us, whoever is at the keyboard.
- Anything touching **real card data or an actual live charge** is marked `[ME]` — see §14 for why, and for the one exception (Claude can navigate up to the Stripe Checkout page and read back results, but the card entry and "Pay" click on a live charge should be Thorsten's, with each real charge confirmed explicitly before it happens).
- A "PASS" requires the *expected result*, not just "didn't crash." Write down the actual behavior if it differs.

---

## 1. System inventory — what "everything" means here

### 1.1 Frontend (React 18 + Vite 6 + TS 5.8 + Tailwind, SPA, bilingual SV/EN)
Pages: `Home` (marketing + pricing), `Scan`, `Dashboard`, `Request`, `Profile`, `Admin`, `Status`, `Roadmap`, `Privacy`, `Terms`.
Shared components: `NavBar`, `AuthModal`, `ConsentModal`, `CookieNotice`, `CompanyCard`, `RequestTypeBadge`, `StatusBadge`, `LevelBadge`, `BrandLogo`.

### 1.2 Backend — Supabase (project `ydkahdqvuykpmjkpunck`, Frankfurt/EU)
- **Auth**: email/password, signup-consent gate, 10-min confirmation expiry, rate limit 30/hr.
- **Postgres**: 35 migrations applied (`001`…`035`), RLS on `profiles`, `audit_logs`, `analytics_events`, `requests`, `signup_consent_records`, `consent_records`.
- **Edge Functions (20)**: `scan-email` *(if still present — confirm, see §2)*, `send-request`, `send-reminders`, `send-followups`, `delete-account`, `cleanup-unconfirmed`, `stripe-checkout`, `stripe-portal`, `stripe-webhook`, `admin-consents`, `admin-delete-user`, `admin-export-user`, `admin-list-users`, `admin-log-login`, `admin-monthly-report`, `admin-stats`, `admin-traffic`, `admin-update-user`, `admin-weekly-db-dump`, `admin-weekly-digest`.
- **pg_cron jobs**: `send-reminders-daily`, `cleanup-unconfirmed-accounts` (every 5 min), `send-followups` (schedule per migration 031), weekly digest / monthly report / weekly DB dump (per migrations 023–024).

### 1.3 Third parties
- **Stripe** (`acct_1TmDjTAT2u1nHxlj`) — Checkout, Billing Portal, webhook, sandbox+live pair kept in sync via a single `STRIPE_MODE` secret.
- **Brevo** — all transactional email (signup confirmation, GDPR request send, reminders, follow-ups, admin digests/reports). Resend is fully decommissioned.
- **XposedOrNot** — free breach-check API, consent-gated per scan.

### 1.4 Hosting/infra
- GitHub Pages via GitHub Actions (`actions/deploy-pages@v4`), Node 22 CI with `tsc --noEmit` gate.
- Custom domain `bliglömd.se` (punycode `xn--bliglmd-e1a.se`), DNS at Strato, TLS via Let's Encrypt, `public/CNAME` persisted every deploy.
- Repo: `github.com/ThorstenGru/bliglomd` — treated as source of truth.

---

## 2. Pre-flight environment check (do this before anything else)

| # | Check | Expected | Result |
|---|---|---|---|
| 2.1 `[CLAUDE]` | Confirm `git status` clean, local == `origin/main` | Clean, in sync | |
| 2.2 `[CLAUDE]` | Read current value of `STRIPE_MODE` secret (can't decrypt value via CLI list — confirm via a harmless code path, e.g. attempt a checkout and see which price IDs are accepted) | Matches intended mode for this test pass | |
| 2.3 `[EITHER]` | Confirm which Stripe **account mode** the Stripe Dashboard is showing (top-left toggle) matches `STRIPE_MODE` | Same mode, no mismatch | |
| 2.4 `[CLAUDE]` | Confirm Stripe webhook endpoint (Dashboard → Developers → Webhooks) is registered for the **live** endpoint URL, enabled, listening for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` | All 5 events enabled, endpoint status "Enabled" | |
| 2.5 `[CLAUDE]` | Confirm `STRIPE_CIPHER_PRICE_ID_LIVE` / `STRIPE_GHOST_PRICE_ID_LIVE` in Supabase secrets match the price IDs hardcoded in `src/config/tiers.ts` (`price_1UKwmcAT2u1nHxljnXod1E5E`, `price_1UKwnWAT2u1nHxljl0QiaEC4`) | Identical | |
| 2.6 `[CLAUDE]` | Load `/status` live and let it finish checking (not "Checking...") | All components green/operational | |
| 2.7 `[CLAUDE]` | Confirm `public/CNAME` still reads `bliglömd.se` and TLS cert is valid (not expiring within 14 days) | Valid | |
| 2.8 `[EITHER]` | Confirm the Stripe **live** balance/payouts destination bank account is correctly set in the Stripe Dashboard (this is the one place a real customer's money will actually go) | Correct account confirmed by Thorsten | |

**Do not proceed past §14 (live payment) until every row above is PASS.**

---

## 3. Golden user journey A–Z (Trace → Cipher/Ghost, free path)

Walk this as a brand-new anonymous visitor, no prior account, in both **sv** and **en** (do the full pass in one language, spot-check the other for parity).

1. `[CLAUDE]` Land on `/` — hero, trust badges ("GDPR Art.17", "Legally reviewed by a Swedish privacy lawyer", "Data stored in Sweden"), pricing cards (Trace/Cipher/Ghost), footer links all present and correctly worded. **Verify the "legally reviewed by a Swedish privacy lawyer" claim is something Thorsten can substantiate** — flag if not, this is a factual claim a regulator or journalist could challenge.
2. `[CLAUDE]` Click "Scan email" → land on `/` scan input (or `/scan` — confirm actual route). Enter a real test email address.
3. `[CLAUDE]` Submit scan **without** ticking the XposedOrNot consent checkbox → submit button disabled / blocked. PASS = cannot bypass.
4. `[CLAUDE]` Tick consent, submit → scan runs, breach results (or "no breaches") shown, company list renders (66+ companies), utgivningsbevis companies flagged first with amber badge.
5. `[CLAUDE]` Use the new company search box → search a company not in the list → confirm a "no results" state is shown (and silently logged for admin's zero-result tracking, verify later in §6).
6. `[CLAUDE]` Attempt to view guided GDPR instructions for a company as an anonymous (not logged in) user → confirm this works without login (Trace is meant to be usable pre-signup) or correctly gates to signup if that's the actual designed boundary — **confirm which behavior is intended vs actual**.
7. `[CLAUDE]` Click "Get started for free" / trigger signup → `AuthModal` opens.
8. `[CLAUDE]` Attempt signup with the required consent checkbox **unticked** → blocked client-side; then attempt via direct API call bypass (if feasible) → confirm the `on_auth_user_created_signup_consent` DB trigger still blocks it server-side (defense in depth, not just UI).
9. `[CLAUDE]` Tick consent, complete signup with a real test mailbox → account created, confirmation email sent.
10. `[CLAUDE]` Confirm the email arrives within a reasonable time, is **not** in spam (or note if it lands in Junk — known historical risk with Brevo/new sender reputation), states the 10-minute deadline correctly, link works.
11. `[CLAUDE]` **Negative case**: create a second signup and deliberately let the 10-minute confirmation window expire → confirm `cleanup-unconfirmed` cron removes the row within ~5–15 min of expiry (check via admin panel or DB, not just absence of complaint).
12. `[CLAUDE]` Log in with confirmed account → land on `/dashboard`. Confirm level shows "Trace" / free.
13. `[CLAUDE]` From dashboard, select a company, generate the Cipher-tier "auto-generated GDPR letter" flow at Trace level → confirm it's correctly gated (upsell to Cipher, not silently free).
14. `[CLAUDE]` Go to `/profile` → edit full name, confirm it persists (reload, revisit). Attempt email change → confirm correct re-verification flow.
15. `[CLAUDE]` From `/profile`, use "delete account" with typed confirmation → confirm the exact confirmation phrase is required (not just a click), confirm `delete-account` edge function actually cascades (no orphaned `requests`/`consent_records`/`analytics_events` tied to a dead user id — spot check in admin or DB).
16. `[CLAUDE]` Re-signup with the same email post-deletion → confirm this is possible (data really gone) and doesn't error as "already exists."

**Bilingual parity spot-check:** repeat steps 1, 4, 9 in the other language — confirm no untranslated strings, no broken interpolation (the historical `lang` not destructured bug — confirm it hasn't regressed), correct SEK/wording, Swedish legal terms (`GDPR Art.17`, `ångerrätt`) not mistranslated in the EN version's legal pages.

---

## 4. Cipher tier journey (paid, letter-generation + tracking)

1. `[CLAUDE]` As a logged-in Trace user, choose Cipher, land on Stripe Checkout (see §14 for the actual charge). Cancel out (`cancel_url` → `/profile`) and confirm nothing was silently charged or half-provisioned.
2. `[ME/CLAUDE per §14]` Complete a real Cipher purchase.
3. `[CLAUDE]` Confirm `checkout.session.completed` webhook fires, `profiles.level` becomes 2, `stripe_customer_id`/`stripe_subscription_id` populated, `subscription_status = 'active'` — check via admin panel, not just UI (UI could be reading stale client cache).
4. `[CLAUDE]` Confirm dashboard immediately reflects Cipher (may require reload — note if a manual refresh is needed, that's a UX gap worth flagging even if not a "bug").
5. `[CLAUDE]` Generate the auto-drafted GDPR letter for a target company → confirm legally-correct structure (references GDPR Art.17, requester identity, company name, request date), copy-to-clipboard works, marking "sent" updates a status/timeline.
6. `[CLAUDE]` Confirm "reminder on missed response" actually schedules (check `requests` table columns added by migrations 030 for follow-up columns) and that `send-reminders` cron would pick it up (can inspect logic without waiting for the real cron tick).
7. `[CLAUDE]` Confirm response tracking UI lets the user mark a company's reply (received/no response) and this is reflected in `/dashboard` and admin stats.

---

## 5. Ghost tier journey (paid, auto-send — the "no ombud" feature)

1. `[CLAUDE]` Upgrade from Cipher → Ghost while an active subscription exists → confirm this uses the **in-place price swap** path in `stripe-checkout` (no duplicate subscription created), `proration_behavior: always_invoice` applied correctly, Stripe Dashboard shows one subscription with one price change, not two subscriptions.
2. `[CLAUDE]` Confirm the swap writes `level`/`subscription_status` immediately client-side (per the code comment, it doesn't wait for the webhook) **and** that the webhook, when it does arrive, doesn't clobber it with a stale/duplicate write.
3. `[CLAUDE]` Trigger a Ghost auto-send request → confirm the outgoing email's **From/Reply-To and body framing sends it as Thorsten's own test account, never claiming BliGlömd is acting as legal representative/agent/"ombud"**. This is a hard product rule — re-read the actual sent email text and confirm no "on behalf of," "authorized agent," or "ombud" language appears anywhere (subject, body, or signature block).
4. `[CLAUDE]` Confirm `requests_ghost_auto_lockdown` (migration 032) actually prevents a non-Ghost user from triggering auto-send via a direct API call (not just UI-hidden).
5. `[CLAUDE]` Confirm automatic follow-up (`send-followups`) is scheduled per the follow-up columns (migration 030) and self-reported BankID reminder columns (migration 034) behave — i.e. a Ghost user who reports "I did the BankID opt-out myself" gets the renewal reminder cadence, not the standard company-response cadence.
6. `[CLAUDE]` Downgrade Ghost → Cipher → Trace via the **Stripe Billing Portal** (`stripe-portal` function) → confirm `customer.subscription.updated`/`.deleted` webhooks correctly step `profiles.level` back down, and that access to Ghost-only actions is revoked immediately (not just at next login).

---

## 6. Admin panel — full walkthrough (`/xadm`, `admin@xn--bliglmd-e1a.se` only)

1. `[CLAUDE]` Attempt admin panel access as a **non-admin** logged-in user (including one who has set `user_metadata.role = 'admin'` on themselves via the browser console — the historical privilege-escalation bug) → confirm hard-blocked both client-side and on every `admin-*` edge function (the fix requires the **exact email**, not just the role claim — this is the single most important regression test in this whole plan).
2. `[CLAUDE]` Log in as `admin@xn--bliglmd-e1a.se` → confirm `admin_login` audit event actually writes a row (this silently failed before the `admin-log-login` edge function fix — re-verify it hasn't regressed to a direct client-side insert).
3. **Users tab**: `[CLAUDE]` Open a real test user's 360 panel → confirm request history, scan history, consent trail (signup + checkout), and subscription/billing status all render correctly and match Stripe/DB ground truth.
4. **Audit tab**: `[CLAUDE]` Confirm filters work, metadata visible, CSV export produces a valid file, and that today's go-live-related admin actions (mode switches, product rebuilds) are logged if they went through admin-gated paths.
5. **Statistik tab**: `[CLAUDE]` Confirm MRR/revenue-by-tier KPI, signups-per-day chart **excludes the admin account** (regression test for the fixed `admin_signups_per_day` RPC), company week-over-week trend table, stale-request drill-down.
6. **Samtycke (Consents) tab**: `[CLAUDE]` Confirm full consent-text modal renders the actual historical Terms/Privacy snapshot text tied to that consent record, not just a version number.
7. **Trafik tab**: `[CLAUDE]` Confirm referrer breakdown, landing/exit pages, funnel conversion %, unmatched-search CSV export (tie back to the company-search-with-no-results test in §3.5), language split.
8. `[CLAUDE]` Confirm the admin account is **excluded** from every customer-facing metric (user counts, MRR, DAU/WAU/MAU) — spot check at least 2 of these, not just the one already fixed.
9. `[CLAUDE]` Attempt to delete the admin account via every path (self-service `delete-account`, `admin-delete-user` targeting itself, raw SQL if you have DB access) → confirm the `protect_admin_account` trigger blocks all of them.
10. `[CLAUDE]` Trigger `admin-weekly-digest`, `admin-monthly-report`, `admin-weekly-db-dump` manually (if they support manual invocation, or via their `*_SECRET` header) → confirm each sends/produces correctly and lands at `admin@xn--bliglmd-e1a.se`, not a stale personal address.

---

## 7. Security & access control regression suite

These are re-tests of previously-found-and-fixed bugs, done again because a go-live rebuild is exactly when regressions creep back in.

1. `[CLAUDE]` **Paywall bypass (migration 027, fix #1)**: as a normal authenticated user, attempt `PATCH .../profiles?id=eq.<self>` with `{"level":3}` directly against the Supabase REST API using the user's own JWT → must be rejected (columns `level`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` are revoked from `authenticated`/`anon`).
2. `[CLAUDE]` **Admin RPC exposure (migration 027, fix #2)**: attempt to call any `admin_*` SECURITY DEFINER function directly via REST/RPC as an anonymous or plain authenticated user → must be rejected (EXECUTE revoked from anon/authenticated).
3. `[CLAUDE]` **Self-delete bypass (migration 027, fix #3)**: attempt `DELETE .../profiles?id=eq.<self>` directly → must be rejected; only the real `delete-account` edge function (service role) can remove a profile.
4. `[CLAUDE]` **Webhook signature/replay**: send a request to `stripe-webhook` with an invalid signature → 400 rejected. Send one with a valid signature but a timestamp >5 minutes old (replay) → rejected per the `constantTimeEqual`/300-second window check.
5. `[CLAUDE]` **CORS**: confirm `stripe-checkout`/`stripe-portal` reject requests from an origin not in `ALLOWED_ORIGINS` (only `https://xn--bliglmd-e1a.se` and localhost dev).
6. `[CLAUDE]` **Analytics abuse surface**: confirm `analytics_events`' public insert policy is still constrained by field-length CHECKs and the 90-day cleanup cron, per its accepted-risk design (low-stakes if spammed) — don't "fix" this, just confirm the mitigations are still in place, not silently removed.
7. `[CLAUDE]` Confirm `.env.local` is not committed, no `sk_live_`/`sk_test_`/service-role key ever appears in a git-tracked file (`git grep` for `sk_live_`, `sk_test_`, `service_role` across the repo).

---

## 8. Legal & compliance verification

1. `[CLAUDE]` Confirm live Privacy Policy version (`2026-09-29-v8` at time of writing) matches what's actually referenced in the current signup-consent DB trigger snapshot — a version bump requires updating **both** `src/config/terms.ts` **and** a new migration; confirm they're in sync (no drift between displayed text and the legally-binding DB snapshot).
2. `[CLAUDE]` Same check for Terms (`2026-09-25-v4`).
3. `[CLAUDE]` Confirm the **ångerrätt (right of withdrawal) waiver** is captured as an explicit, timestamped consent at the moment of each purchase (Distansavtalslagen 2 kap. 12 § requires this be confirmed on a durable medium) — verify whether this confirmation is ever **emailed** to the customer, not just stored in BliGlömd's DB (a prior legal assessment flagged this gap; confirm current status).
4. `[CLAUDE]` Confirm the refund-exception clause (§5, "failure to deliver") has an actual operational process behind it — i.e. if Thorsten needs to honor it, does he know where in Stripe/admin to process a manual refund? Not a code test, but a real go-live gap if the answer is "no runbook exists."
5. `[CLAUDE]` Confirm organisationsnummer (969797-1647) and registered entity (Lykkebo Fastigheter Kommanditbolag) are disclosed on both Terms and Privacy per Lag om elektronisk handel §§8–10 (this was an open gap in the 2026-07-01 assessment — confirm migration 026 actually closed it).
6. `[CLAUDE]` Confirm the XposedOrNot consent-gate (§3.3 above) still requires **explicit, separate** consent per scan, matches the Privacy Policy §4 disclosure text exactly (name, caveat about no disclosed entity/jurisdiction).
7. `[CLAUDE]` Confirm the exclusive-forum clause reads **Helsingborgs tingsrätt**, and that Terms.tsx/config/terms.ts/ConsentModal.tsx are all consistent (no page showing Stockholm).
8. `[CLAUDE]` Re-confirm the "legally reviewed by a Swedish privacy lawyer" homepage claim (§3.1) — if no such review exists or is stale, this is a false-advertising risk that should be fixed or softened before real customers see it, independent of any code test.
9. `[ME]` Decide whether the "no refunds under any circumstances" framing in Terms §5 needs a lawyer's final sign-off given the Konsumentköplagen tension flagged in the 2026-07-01 assessment — this plan can verify the code/DB implements what the Terms *say*, it cannot verify the Terms are *enforceable*.

---

## 9. Email & deliverability

| Email | Trigger | Provider path | Check |
|---|---|---|---|
| Signup confirmation | `/scan` → signup | Supabase Auth SMTP via Brevo | Arrives, correct 10-min deadline text, link works, not stuck in spam |
| GDPR request send (Ghost) | Ghost auto-send | `send-request` → Brevo | Correct company address, correct "as you" framing (see §5.3) |
| Reminder (missed response) | `send-reminders` cron | Brevo | Fires ~30 days per copy, correct recipient |
| Follow-up (Ghost) | `send-followups` cron | Brevo | Fires per schedule in migration 031 |
| Admin weekly digest | `admin-weekly-digest` | Brevo → `admin@xn--bliglmd-e1a.se` | Arrives at the right mailbox, contains real (not stale) numbers |
| Admin monthly report | `admin-monthly-report` | Brevo | Same |
| Admin weekly DB dump | `admin-weekly-db-dump` | Brevo (attachment?) | Confirms dump content is non-empty and restorable |
| Delete-account confirmation | account deletion | — confirm whether one is even sent | If none exists, decide if that's acceptable |

`[CLAUDE]` For each row: confirm DKIM/SPF/DMARC still pass (`dig` or Brevo dashboard), confirm sender is `noreply@xn--bliglmd-e1a.se`, confirm no email is silently landing in spam without at least the known mitigation copy ("check your spam folder") being present where relevant.

---

## 10. Data & backend integrity

1. `[CLAUDE]` `supabase migration list` / compare `supabase/migrations` folder vs what's actually applied on the linked project — zero drift.
2. `[CLAUDE]` Confirm all cron jobs are active and their last-run timestamps are recent/sane (`cron.job_run_details` or equivalent) — not silently stalled since some earlier date.
3. `[CLAUDE]` Spot-check `audit_logs` for completeness on a scripted test admin action (e.g. a test `admin-update-user` call) — confirm a row appears with correct metadata.
4. `[CLAUDE]` Confirm `requests` table's `type`/uniqueness constraint (migration 029) actually prevents duplicate simultaneous requests to the same company for the same user.
5. `[CLAUDE]` Confirm the weekly DB dump is actually restorable (spin up a scratch check, don't just confirm the file exists).

---

## 11. Infra / hosting / CI

1. `[CLAUDE]` Trigger a no-op PR or re-run the latest Actions workflow → confirm `tsc --noEmit` gate still fails the build on a deliberately introduced type error (sanity check the gate is real, not silently skipped).
2. `[CLAUDE]` Confirm `actions/deploy-pages@v4` deploy completes and `public/CNAME` survives in the deployed output.
3. `[CLAUDE]` Confirm DNS A/AAAA/CNAME records at Strato are unchanged and TLS auto-renewal is on track.
4. `[CLAUDE]` Load the live site from a cold cache (or incognito/different network) to rule out stale-CDN illusions before signing off on any "it's fixed" claim (known historical gotcha — see PDF-as-instruction memory).

---

## 12. Cross-cutting checks

- **Responsive/mobile**: `[CLAUDE]` resize to mobile width, re-walk §3 steps 1–9 and the pricing cards/checkout entry point.
- **Accessibility**: `[CLAUDE]` spot-check today's a11y commit (`e72075b`) actually improved something checkable (keyboard nav through pricing cards and AuthModal, focus trap in modals, alt text on icons/badges).
- **Cookie notice**: `[CLAUDE]` confirm the new `CookieNotice` component's copy matches the Privacy Policy §7 claims exactly (no cookie-consent-required claim that contradicts "strictly necessary, no consent needed").
- **Browser matrix**: `[EITHER]` spot check Chrome + at least one of Safari/Firefox for the checkout flow specifically (Stripe.js/redirect behavior is the most likely cross-browser breakage point).
- **Roadmap page**: `[CLAUDE]` confirm `/roadmap` (footer "Coming soon" link) renders correctly and doesn't promise anything already contradicted by the Terms' "no guarantees, features may be removed without notice" clause.

---

## 13. Negative / abuse / edge cases

1. `[CLAUDE]` Double-click "Choose Cipher" rapidly → confirm no duplicate Checkout Sessions / duplicate subscriptions.
2. `[CLAUDE]` Apply an invalid/expired promo code at checkout → clear error, no charge.
3. `[CLAUDE]` Apply `GLOMD10` (or its live equivalent) → confirm 10% discount actually applies to the live-mode price, and confirm the promo code Stripe API version pin (`Stripe-Version: 2024-06-20`) is still needed/working if promo codes are created again in the future.
4. `[CLAUDE]` Let a subscription payment fail (test via Stripe test clocks in sandbox, since this can't be safely forced in live) → confirm `invoice.payment_failed` immediately drops the user to Trace, and a later `invoice.payment_succeeded` restores the correct level.
5. `[CLAUDE]` Cancel via Stripe Portal mid-cycle → confirm behavior matches Terms §3 ("cancel anytime, no binding period") — does access end immediately or at period end? Confirm the code's actual behavior matches what the Terms promise the customer.
6. `[CLAUDE]` Attempt checkout while logged out (session expired mid-flow) → clean re-auth prompt, no half-created Stripe customer orphaned without a linked profile.
7. `[CLAUDE]` Submit the scan form with an obviously fake/malformed email → server-side validation, no crash, no XSS reflection of the input anywhere it's later displayed (dashboard, admin panel, emails).

---

## 14. LIVE-mode financial verification — the real-money gate

**Read this section before touching anything here.**

This is the one part of the plan involving real money and real card data. A few hard boundaries, independent of anything else in this document:

- I (Claude) will not enter real card numbers, CVC, or other payment credentials into any field, and will not click the final "Pay"/submit on an actual live charge myself — that step is Thorsten's to do, each time, even if we've done it before in this same session.
- I can drive every step *up to* the Stripe Checkout page (auth, tier selection, promo code, cancel path), and everything *after* the charge (reading back webhook results, DB state, admin panel, Stripe Dashboard) — just not the moment of payment itself.
- Any purchase is real money leaving a real card and landing in Thorsten's real Stripe balance. Keep amounts minimal (Trace is free; a single Cipher month at ~99 kr or the one-time cleanup at ~199 kr, whichever exists live, is the cheapest way to prove the live path end-to-end) and refund/cancel immediately after confirming the flow, if that's the intent.

### Steps

1. `[ME]` Confirm which card will be used for the live test purchase, and confirm you're OK with a real ~99–199 kr charge for verification purposes (refundable via Stripe Dashboard afterward if desired).
2. `[CLAUDE]` Drive the full journey up to Stripe Checkout: fresh test account (or a dedicated `founder-test@...` mailbox) → Trace → Cipher upgrade click → land on the real live Stripe Checkout page. Confirm the page shows the correct live-mode branding, correct price (99 kr/mo or current live price), correct company name/logo if configured.
3. `[ME]` Enter real card details and complete the purchase.
4. `[CLAUDE]` Immediately after redirect back to `/dashboard?upgraded=1`: confirm `checkout.session.completed` fired, `profiles.level = 2`, `subscription_status = 'active'`, `stripe_customer_id`/`stripe_subscription_id` populated — check the DB directly, don't trust only the UI.
5. `[CLAUDE]` Confirm the transaction appears correctly in the **live** Stripe Dashboard (Payments, Customers, Subscriptions) — correct amount, correct currency (SEK), correct product/price name (not a stale sandbox-looking product).
6. `[CLAUDE]` Confirm the admin panel's Statistik/MRR tab picks up this real transaction correctly.
7. `[ME]` Decide: keep this as a genuine first paying customer record, or cancel/refund it via the Stripe Dashboard (or `stripe-portal`) now that the flow is proven. If refunding, confirm afterward that the webhook-driven downgrade (`customer.subscription.deleted` → `level = 1`) actually fires.
8. `[EITHER]` Optionally repeat steps 2–7 once for Ghost, and once for the Cipher→Ghost in-place-swap path (§5.1), to prove every paid path was exercised in live mode at least once before broad customer traffic.
9. `[ME]` Final decision point: after all of the above passes, this plan's purpose is complete — BliGlömd is verified end-to-end in live mode. Any FAIL found above should block sign-off until fixed and re-tested.

---

## 15. Go-live sign-off checklist (one page, print/check this)

- [ ] §2 Pre-flight — all rows PASS
- [ ] §3 Trace journey — full pass, both languages spot-checked
- [ ] §4 Cipher journey — full pass including real webhook verification
- [ ] §5 Ghost journey — full pass including "no ombud" email-text check
- [ ] §6 Admin panel — all 6+ tabs walked, admin protections re-confirmed
- [ ] §7 Security regression suite — all 4 historical bugs re-confirmed fixed
- [ ] §8 Legal/compliance — version sync confirmed, open items acknowledged (not necessarily closed)
- [ ] §9 Email deliverability — every email type confirmed sent + landed
- [ ] §10 Data integrity — migrations/cron/audit confirmed healthy
- [ ] §11 Infra/CI — deploy pipeline and DNS/TLS confirmed
- [ ] §12 Cross-cutting — mobile, a11y, cookie notice, browser matrix spot-checked
- [ ] §13 Negative/abuse cases — all attempted, all handled safely
- [ ] §14 Live-mode financial gate — at least one real Cipher **and** one real Ghost transaction proven end-to-end
- [ ] All FAILs from any section above resolved and re-tested
- [ ] Thorsten's final go/no-go decision recorded here: ______________________

---

## 16. Known open items / accepted-risk register (carried over from prior audits — re-confirm status, don't assume closed)

| Item | Status as of last known check | Re-verify |
|---|---|---|
| XposedOrNot has no disclosed legal entity/jurisdiction for a DPA | Resolved via disclosure + explicit consent (not a DPA) — accepted risk | Confirm consent gate still enforced (§3.3, §8.6) |
| Ångerrätt-waiver confirmation never emailed to customer, only stored in DB | Open as of 2026-07-01 assessment | §8.3 |
| "No refunds under any circumstances" clause vs. Konsumentköplagen mandatory remedies | Open, needs lawyer review | §8.9 |
| Brevo's un-disableable open-tracking pixel + List-Unsubscribe header vs. "no tracking" positioning | Accepted tradeoff, user informed | No action needed, just don't forget it when auditing "no tracking" claims |
| First Brevo sends landing in Apple/iCloud Junk | Expected to improve with sender reputation over time | §9 spot-check current inbox placement |
| Admin's own signup appearing in the "Registreringar per dag" chart (cosmetic only) | Low priority, not fixed | §6.5 — confirm still cosmetic-only, hasn't grown teeth |
| First live-mode go-live attempt was misconfigured and reverted same day (2026-09-29) | Rebuilt with fresh products/webhook | This entire plan exists because of this — do not skip §14 |

---

## 17. Appendix

- **Repo**: `github.com/ThorstenGru/bliglomd`, local at `...\Desktop\Claude Code Folder\bliglomd`.
- **Rollback plan if live mode misbehaves again**: flip `STRIPE_MODE` back to `sandbox` (single Supabase secret), redeploy frontend if `tiers.ts` price IDs also need reverting to the sandbox pair noted in code comments (`price_1UJF2CAR7wxHkiWgazzRxQYe` Cipher, `price_1UJF2DAR7wxHkiWgOIfZS2jj` Ghost).
- **Admin identity**: `admin@xn--bliglmd-e1a.se`, undeletable, excluded from customer metrics.
- **Contact for legal/data queries shown to customers**: `kontakt@bliglömd.se`.

---

*This plan should be re-run in full (not just §14) after any future change to: Stripe products/prices, webhook logic, RLS policies, admin gating, or consent/legal text — not just before the very first go-live.*
