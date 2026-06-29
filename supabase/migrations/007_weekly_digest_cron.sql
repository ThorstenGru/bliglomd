-- ── WEEKLY ADMIN DIGEST — pg_cron + pg_net schedule ──────────────────────────
-- Calls the admin-weekly-digest edge function every Monday at 07:00 UTC.
-- DIGEST_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'digest-secret', '...');
-- and as an edge function env via:
--   supabase secrets set DIGEST_SECRET=<uuid>

select cron.schedule(
  'admin-weekly-digest',
  '0 7 * * 1',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/admin-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'digest-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
