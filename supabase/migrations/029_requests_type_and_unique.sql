-- Part 1 of closing the Cipher/Ghost tier-promise gaps:
--
-- request_type is added so cron jobs (e.g. the upcoming general 30-day
-- follow-up) can filter gdpr_art17 vs opt_out requests without duplicating
-- the company-id list from src/data/companies.ts into every function, the
-- way send-reminders already does today.
--
-- The unique constraint on (user_id, company_id) turns every insert into an
-- upsert target, so revisiting a company's request page and copying/sending
-- again updates the same tracked row instead of cluttering the dashboard
-- with duplicates -- this also fixes a latent duplicate-row possibility in
-- Ghost's existing send flow, which had no such constraint before.
alter table public.requests add column if not exists request_type text;

alter table public.requests
  add constraint requests_user_company_unique unique (user_id, company_id);
