-- Part 2 of closing the Ghost tier-promise gap (automatic follow-up / reminder
-- on no response) -- the only existing reminder job is hardcoded to 5 opt-out
-- sites' 12-month renewal, unrelated to "did this company respond to my GDPR
-- request". These columns let a new general follow-up job be self-contained
-- (no need to hardcode/duplicate the growing company list from
-- src/data/companies.ts into yet another edge function):
--
-- sent_via distinguishes a Ghost auto-send from a Cipher self-reported "I sent
-- this" -- only Ghost's promise includes BliGlömd following up with the
-- company itself; Cipher only ever gets nudged as the user.
--
-- company_gdpr_email is captured at send time so the follow-up job can email
-- the company directly without re-deriving it from the frontend's static data.
--
-- escalated_at marks a request as already handled by the 30-day job, so it
-- fires exactly once per request rather than every day thereafter.
alter table public.requests add column if not exists sent_via text
  check (sent_via is null or sent_via in ('ghost_auto', 'cipher_manual'));
alter table public.requests add column if not exists company_gdpr_email text;
alter table public.requests add column if not exists escalated_at timestamptz;
