-- Enable pg_cron (pre-installed on Supabase, needs activating)
create extension if not exists pg_cron with schema pg_catalog;

-- Enable pg_net for outbound HTTP calls
create extension if not exists pg_net with schema extensions;

-- Grant cron usage to postgres role
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Schedule send-reminders edge function daily at 09:00 UTC
select cron.schedule(
  'send-reminders-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
