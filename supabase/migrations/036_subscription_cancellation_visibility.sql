-- Found during go-live verification 2026-09-30: a customer who schedules a
-- cancellation via the Stripe billing portal ("cancel at period end") sees
-- that reflected in Stripe's own portal, but BliGlömd's own Profile page had
-- no idea it existed -- we never stored cancel_at_period_end/current_period_end
-- anywhere, so the app just showed "Ghost, Aktiv" with no hint the plan is
-- ending. Access itself was correctly preserved until period end (level/
-- subscription_status logic already handles that right); this only adds the
-- missing visibility.

alter table public.profiles
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end timestamptz;
