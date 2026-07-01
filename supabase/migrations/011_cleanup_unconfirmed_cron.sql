-- ── CLEANUP UNCONFIRMED ACCOUNTS — pg_cron + pg_net schedule ─────────────────
-- Calls the cleanup-unconfirmed edge function every 5 minutes. It deletes any
-- auth.users row that is still unconfirmed 10+ minutes after signup — the
-- confirmation email link (also set to expire at 10 min) and the account
-- lifetime are kept in lockstep.
-- CLEANUP_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'cleanup-secret', '...');
-- and as an edge function env via:
--   supabase secrets set CLEANUP_SECRET=<uuid>

select cron.schedule(
  'cleanup-unconfirmed-accounts',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/cleanup-unconfirmed',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'cleanup-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
