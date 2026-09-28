-- CRITICAL pre-go-live security fixes, found by a full audit:
--
-- 1) Paywall bypass: the single "FOR ALL USING (auth.uid()=id)" policy on profiles
--    let any authenticated user UPDATE their own level/subscription_status/
--    stripe_customer_id/stripe_subscription_id directly via the REST API --
--    e.g. PATCH .../profiles?id=eq.<self> {"level":3} granted free Ghost access
--    with zero Stripe payment. Those columns must only ever be written by
--    service-role code (stripe-webhook / stripe-checkout).
--
-- 2) All 19 admin_* SECURITY DEFINER functions were EXECUTE-able by anon and
--    authenticated with no internal admin check, bypassing RLS entirely --
--    anyone with just the public anon key could call them, no login required.
--    The admin-* edge functions already use a service-role client, so revoking
--    public EXECUTE costs nothing functionally.
--
-- 3) profiles also allowed self-DELETE via the same ALL-policy, bypassing the
--    real delete-account flow (and the Stripe-cancellation fix that adds).

-- ── Fix 1: lock down the protected profile columns ─────────────────────────
revoke update (level, subscription_status, stripe_customer_id, stripe_subscription_id)
  on public.profiles from authenticated, anon;

revoke delete on public.profiles from authenticated, anon;

-- Defense in depth: even if a future grant accidentally reopens column access,
-- this trigger reverts those columns unless the actor is service_role.
create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.level := old.level;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_billing_columns on public.profiles;
create trigger protect_profile_billing_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_billing_columns();

-- ── Fix 2: revoke public execute on every admin_* RPC ──────────────────────
do $$
declare
  fn record;
begin
  for fn in
    select routine_name, pg_get_function_identity_arguments(p.oid) as args
    from information_schema.routines r
    join pg_proc p on p.proname = r.routine_name
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where r.routine_schema = 'public' and r.routine_name like 'admin\_%'
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon, authenticated;',
      fn.routine_name, fn.args
    );
  end loop;
end $$;

-- Note: is_admin() is deliberately NOT revoked here -- it's referenced inside
-- RLS policies on audit_logs/admin_deletions/analytics_events (USING (is_admin())),
-- which are evaluated as the querying (authenticated) role. Revoking EXECUTE
-- on it would break the admin account's own access through those policies.
-- It's lower risk anyway per the audit: it only reflects the caller's own JWT.
