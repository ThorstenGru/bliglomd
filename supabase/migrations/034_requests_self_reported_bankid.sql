-- Closes the "Ghost BankID renewal reminder" reachability gap: Ratsit, Merinfo,
-- Hitta.se and Birthday.se are BankID-only opt-outs with no gdpr_email at all (email
-- genuinely doesn't work for them, per their own instructions) -- so neither Cipher's
-- "mark as sent" letter-tracking nor Ghost's auto-send panel ever renders for them
-- (both require company.gdpr_email), meaning no 'sent' row could ever exist for the
-- reminder cron to act on. BliGlömd can't do the BankID step for anyone regardless of
-- tier (identity verification can't be delegated), so tracking "I did this myself" is
-- added as its own self-report affordance, open to any tier -- the Ghost-exclusive part
-- stays exclusive at the *reminder email* step (send-reminders now checks the user's
-- current profile.level before emailing), not at the tracking step.
alter table public.requests drop constraint if exists requests_sent_via_check;
alter table public.requests add constraint requests_sent_via_check
  check (sent_via is null or sent_via in ('ghost_auto', 'cipher_manual', 'self_reported'));
