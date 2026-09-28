-- ── GENERAL 30-DAY FOLLOW-UP — pg_cron + pg_net schedule ───────────────────
-- Calls send-followups daily at 09:30 UTC (staggered 30 min after the existing
-- send-reminders-daily job). Closes requests.sent_at + 30 days with no
-- response: nudges the user, and for Ghost-sent requests, auto-follows-up
-- with the company itself.
-- FOLLOWUPS_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'followups-secret', '...');
-- and as an edge function env via:
--   supabase secrets set FOLLOWUPS_SECRET=<uuid>

select cron.schedule(
  'send-followups-daily',
  '30 9 * * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/send-followups',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'followups-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
