# BliGlömd SEO content plan (2026-09-30)

Site was unindexed at time of writing (no results for `site:bliglömd.se`). Priority is
getting a first batch of high-intent, low-competition pages indexed — not competing on
broad terms yet.

## Pattern

One guide per company already in `src/data/companies.ts`, each answering "how do I get
my data off X" — the exact phrase people search, and matching content BliGlömd already
has verified (`instructions_sv`, `bankid_required`, `utgivningsbevis`, etc.), so no new
legal research is needed per page — just turn existing structured data into prose.

Each guide:
- Static HTML under `public/guider/<slug>/index.html` (no JS execution required to read it — same pattern as the Ratsit page)
- HowTo + FAQPage JSON-LD
- Explains *why* (GDPR Art. 17 vs. opt-out vs. BankID-gated vs. utgivningsbevis-protected) — this nuance is what the generic "GDPR removal" advice out there gets wrong or oversimplifies, so it's the differentiation
- Ends with a CTA back to the app
- Added to `public/sitemap.xml`

**Do not give away what's actually sold.** The free (Trace) tier already includes guided
per-company instructions in-app — that's fine to echo publicly. But the paid tiers
(Cipher 99kr: auto-generated legal letter; Ghost 199kr: send + track + renewal reminders
on BliGlömd's behalf) must NOT be fully reproduced on a public page with no signup wall.
Concretely: explain the legal mechanism and what's involved in plain language, but don't
spell out ready-to-use letter text, exact company email addresses, or a literal numbered
click-by-click walkthrough — keep it one level more abstract than the in-app instructions,
and let the CTA be the reason to go create a (free) account. This was flagged directly by
the user on the first guide (Ratsit) — see `feedback_seo_content_gating` memory.

## First 10 guides, by estimated search intent (highest first)

Priority order weighted by: (a) how often people search the exact company name + "radera/ta bort/dölja", (b) whether the removal process is confusing enough to need a guide (BankID-gated, opt-out vs. deletion, time-limited), (c) already shipped as an example.

1. **Ratsit** — `/guider/radera-fran-ratsit/` — ✅ done. BankID opt-out, 12-month renewal, utgivningsbevis.
2. **Mrkoll** — `/guider/radera-fran-mrkoll/` — ✅ done. No BankID, opt-out via email/form, framed around the "vague requests get rejected" angle (real differentiator: Cipher tier auto-generates a precise request).
3. **Hitta.se** — `/guider/radera-fran-hitta/` — ✅ done. BankID opt-out, Schibsted-owned, framed around "this doesn't cover the other sites" (no paid tier available for this one — BankID-gated, so nothing to protect here, but kept the same abstraction level for consistency).
4. **Lexbase** — `/guider/radera-fran-lexbase/` — ✅ done. Criminal records/convictions; framed around "opt-out hides it from Lexbase's search, doesn't unpublish the verdict itself."
5. **Merinfo** — `/guider/radera-fran-merinfo/` — ✅ done. BankID opt-out, same pattern as Ratsit/Hitta.se.
6. **Google (deindexing)** — `/guider/ta-bort-fran-google-sok/` — ✅ done. Framed around "delisting ≠ deletion" and the URL-specificity requirement.
7. **Allabolag** — `/guider/radera-fran-allabolag/` — ✅ done. Board-member/signatory data from Bolagsverket; framed around what can be corrected vs. what's permanent public record.
8. **Krimfup / Biluppgifter / Upplysning** — ✅ done as a hub page: `/guider/upplysningssajter-sverige/`, with a comparison table and links to all 5 individual guides already live.
9. **Facebook/Instagram** — `/guider/radera-fran-facebook-instagram/` — ✅ done. Deactivate vs. delete distinction, retention-after-deletion nuance.
10. **Klarna** — `/guider/radera-fran-klarna/` — ✅ done. Bokföringslagen's 7-year retention vs. GDPR, what's actually deletable.

All 10 guides live as of 2026-10-01. Each links back to `/` with a CTA; the hub page
additionally cross-links the 5 data-broker guides to each other.

## Hub page

✅ Done — `/guider/upplysningssajter-sverige/`, built once 5 guides existed as planned.
Targets "vilka upplysningssajter finns" and broader "ta bort mig från internet" queries,
and is the natural internal-linking hub for the data-broker guides.

## Next steps (not yet done)

- **Search Console: done (2026-10-01, later date).** User verified via HTML file method
  (`public/google9b79c7d4878035d4.html`), submitted the sitemap, and requested indexing
  for the initial batch of URLs. Bing Webmaster Tools (import-from-Google path) still open.

## Round 2 guides — ✅ done (2026-10-01)

Added after the first 10, per the "what else can drive traffic" discussion:

- **`/guider/bliglomd-vs-doldadress/`** — comparison page vs. the main competitor.
  Deliberately factual/neutral (deletion vs. hiding, free tier vs. none, no binding vs.
  3–12 month binding) rather than citing competitor reviews — comparative-advertising
  risk isn't worth it, and the structural differences are persuasive on their own. Facts
  re-verified live on doldadress.se on 2026-10-01 before publishing (previous research
  was 92 days stale).
- **Swish, Snapchat, Microsoft, Adobe, TikTok** — same pattern as round 1: legal/
  procedural nuance in full (bokföringslagen 7-year retention for Swish, Snapchat's
  30-day deactivation window, Microsoft's "close account vs. targeted deletion"
  distinction, Adobe's cloud-file warning, TikTok's Irish EEA entity), no literal
  copy-paste scripts.

All now in `public/sitemap.xml`. Not yet submitted individually via Search Console's
URL Inspection — do that for this batch same as the first.

## Distribution attempted beyond SEO (2026-10-01)

- **AppRater (apprater.net/add)**: submitted successfully — free, no-account form.
- **GitHub "awesome-privacy" lists**: investigated, ruled out. They require open-source
  licensing and a 4-month-minimum repo age; BliGlömd is proprietary and the repo is new.
  Don't revisit this path unless both of those change.
- **Other free/no-login startup directories**: most require account creation (Product
  Hunt, Indie Hackers, Crunchbase, F6S, etc.) — per policy, Claude doesn't create
  accounts on the user's behalf. These need the user to sign up themselves if pursued.
  The sandbox's auto-mode classifier also blocks some third-party form-field writes
  ("External System Writes") even on no-account forms — AppRater's text fields went
  through, but its URL/platform fields were blocked and the user had to finish the
  submission manually from a pre-filled draft. Expect to hand off the same way for any
  future directory, not assume full automation will work.
- Once there's some organic indexing, decide whether round 2 (Swish, TikTok, Snapchat,
  Microsoft, Adobe, bank data broker pages) is worth it or whether effort should shift to
  the comparison-vs-doldadress.se page instead.

## Not yet worth doing

- **Full blog/CMS setup** — premature before there's a proven content-to-signup pattern from the first few static guides.
- **hreflang / URL-based English version** — language is currently a client-side toggle (localStorage), not a URL. Not worth restructuring routing for this until Swedish content is proven; flag as backlog if UK/international expansion becomes a real goal.
- **Comparison page vs. doldadress.se** — good idea (see `competitor_doldadress` research) but a distinct piece of work from the technical/company-guide track; do as its own follow-up once guides are live and indexed.

## Distribution (cheap, do alongside publishing)

- Submit `sitemap.xml` in Google Search Console + Bing Webmaster Tools (takes 10 minutes, currently not done — the domain has never been verified in either).
- Post to r/sweden / Flashback when guides go live — GDPR/data-broker removal is a recurring thread topic there; a genuinely useful guide (not a sales pitch) earns backlinks organically.
- Swedish consumer-tech journalists (Ny Teknik, Breakit, Aftonbladet Konsument-desken) are a realistic pitch target given the utgivningsbevis/GDPR angle is genuinely novel reporting territory.
