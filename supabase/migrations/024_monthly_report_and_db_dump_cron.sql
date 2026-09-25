-- ── MONTHLY STRIPE PURCHASE REPORT — pg_cron + pg_net schedule ────────────────
-- Calls admin-monthly-report on the 1st of every month at 07:00 UTC, reporting
-- on the previous calendar month's paid Stripe invoices (live mode).
-- MONTHLY_REPORT_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'monthly-report-secret', '...');
-- and as an edge function env via:
--   supabase secrets set MONTHLY_REPORT_SECRET=<uuid>

select cron.schedule(
  'admin-monthly-report',
  '0 7 1 * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/admin-monthly-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'monthly-report-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- ── WEEKLY DB DUMP — pg_cron + pg_net schedule ─────────────────────────────────
-- Calls admin-weekly-db-dump every Sunday at 06:00 UTC (staggered an hour ahead
-- of the Monday 07:00 weekly digest). Exports every public-schema table as a
-- zipped set of CSVs (auth schema is intentionally excluded — see function).
-- DB_DUMP_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'db-dump-secret', '...');
-- and as an edge function env via:
--   supabase secrets set DB_DUMP_SECRET=<uuid>

select cron.schedule(
  'admin-weekly-db-dump',
  '0 6 * * 0',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/admin-weekly-db-dump',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'db-dump-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
