-- send-reminders was deployed with gateway JWT enforcement off (correct, since
-- pg_cron can never present a Supabase session JWT) but had NO auth check of its
-- own — the endpoint was fully open on the public internet, letting anyone spam
-- real customers with "your protection expires soon" emails and flip their
-- requests.status to 'expired' on demand. Fixed with the same Vault-secret
-- bearer pattern already used for cleanup-unconfirmed / admin-weekly-digest.
-- REMINDERS_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'reminders-secret', '...');
-- and as an edge function env via:
--   supabase secrets set REMINDERS_SECRET=<uuid>

select cron.schedule(
  'send-reminders-daily',
  '0 9 * * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'reminders-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
