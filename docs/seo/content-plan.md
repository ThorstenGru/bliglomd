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

## First 10 guides, by estimated search intent (highest first)

Priority order weighted by: (a) how often people search the exact company name + "radera/ta bort/dölja", (b) whether the removal process is confusing enough to need a guide (BankID-gated, opt-out vs. deletion, time-limited), (c) already shipped as an example.

1. **Ratsit** — `/guider/radera-fran-ratsit/` — ✅ done. BankID opt-out, 12-month renewal, utgivningsbevis.
2. **Mrkoll** — `/guider/radera-fran-mrkoll/` — same opt-out pattern, one of the most-searched "ta bort mig från nätet" targets.
3. **Hitta.se** — `/guider/radera-fran-hitta/` — very high search volume, people don't realize it's a separate opt-out from Ratsit/Mrkoll.
4. **Lexbase** — `/guider/radera-fran-lexbase/` — publishes criminal records/convictions; highest emotional urgency of any company in the list, worth a dedicated page.
5. **Merinfo** — `/guider/radera-fran-merinfo/` — same category, different opt-out flow.
6. **Google (deindexing / "right to be forgotten")** — `/guider/ta-bort-fran-google-sok/` — huge search volume for "radera mig från google", different mechanism (search removal request, not data deletion) so needs its own explainer.
7. **Allabolag** — `/guider/radera-fran-allabolag/` — company/board-member personal data, common search from people listed as company officers.
8. **Krimfup / Biluppgifter / Upplysning** — bundle as one comparison guide: `/guider/upplysningssajter-sverige/` — "vilka upplysningssajter finns" is a real query and a good hub page linking to all individual guides.
9. **Facebook/Meta & Instagram account deletion** — `/guider/radera-fran-facebook-instagram/` — evergreen high-volume query, different mechanism (account deletion, not GDPR request) but still on-topic.
10. **Klarna / Swish** — `/guider/radera-fran-klarna/` — financial data, high anxiety topic, good for trust-building even though deletion is often restricted by law (bookkeeping retention) — worth explaining the limits honestly.

## Hub page

Once 4-5 guides exist, add `/guider/` index page linking all of them — internal linking
matters more than volume at this stage, and it becomes the natural page to target
"radera mig från internet guide" as a broader term.

## Not yet worth doing

- **Full blog/CMS setup** — premature before there's a proven content-to-signup pattern from the first few static guides.
- **hreflang / URL-based English version** — language is currently a client-side toggle (localStorage), not a URL. Not worth restructuring routing for this until Swedish content is proven; flag as backlog if UK/international expansion becomes a real goal.
- **Comparison page vs. doldadress.se** — good idea (see `competitor_doldadress` research) but a distinct piece of work from the technical/company-guide track; do as its own follow-up once guides are live and indexed.

## Distribution (cheap, do alongside publishing)

- Submit `sitemap.xml` in Google Search Console + Bing Webmaster Tools (takes 10 minutes, currently not done — the domain has never been verified in either).
- Post to r/sweden / Flashback when guides go live — GDPR/data-broker removal is a recurring thread topic there; a genuinely useful guide (not a sales pitch) earns backlinks organically.
- Swedish consumer-tech journalists (Ny Teknik, Breakit, Aftonbladet Konsument-desken) are a realistic pitch target given the utgivningsbevis/GDPR angle is genuinely novel reporting territory.
