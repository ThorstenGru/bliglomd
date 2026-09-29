-- The `requests` table's only RLS policy (001_initial_schema.sql) is FOR ALL USING
-- (auth.uid() = user_id) with no WITH CHECK, which Postgres reuses as the write-side
-- check too -- so it only ever restricted *whose* row gets written, never *which
-- values* land in it. That let any authenticated (even free-tier) caller upsert
-- sent_via='ghost_auto' directly via the REST API, which (a) bypassed the Ghost
-- paywall for the auto-follow-up feature, and (b) let send-followups' company-facing
-- auto-follow-up email (gated only on sent_via='ghost_auto' + company_gdpr_email) be
-- redirected to an attacker-chosen address, since company_gdpr_email rode along in the
-- same forged upsert.
--
-- The Ghost auto-send flow now writes this row itself from the send-request edge
-- function (service-role, after its own independent Ghost-tier check) instead of the
-- client doing a separate direct upsert -- so no legitimate client-side write of
-- sent_via='ghost_auto' should exist any more. This trigger makes that unenforceable
-- by direct-API bypass rather than just no-longer-used by the UI.
create or replace function public.protect_requests_ghost_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.sent_via = 'ghost_auto' then
    new.sent_via := case when TG_OP = 'UPDATE' then old.sent_via else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_requests_ghost_auto_trigger on public.requests;
create trigger protect_requests_ghost_auto_trigger
before insert or update on public.requests
for each row execute function public.protect_requests_ghost_auto();
