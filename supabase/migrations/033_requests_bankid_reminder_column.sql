-- Separates "sent the 11-month renew-soon nudge" from "the 12-month BankID protection
-- actually lapsed" (send-reminders previously conflated these into a single status='expired'
-- write at the 11-month mark, contradicting the reminder email's own "expires in about a
-- month" wording for the following 30 days).
alter table public.requests
  add column if not exists bankid_reminder_sent_at timestamptz;
