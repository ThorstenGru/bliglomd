-- ── SECURITY FIX: admin gating must not rely on user_metadata.role alone ─────
-- user_metadata is self-editable by ANY logged-in user via
-- supabase.auth.updateUser({ data: { role: 'admin' } }) from the browser
-- console — role alone was never a safe authorization boundary. Every RLS
-- policy that previously checked only role now also requires the exact
-- admin email. Edge functions get the equivalent fix in the same deploy.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public as $$
  select (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
     and (auth.jwt() ->> 'email') = 'admin@xn--bliglmd-e1a.se';
$$;

drop policy if exists "Admin reads audit logs" on public.audit_logs;
create policy "Admin reads audit logs" on public.audit_logs
  for select using (public.is_admin());

drop policy if exists "Admin deletes audit logs" on public.audit_logs;
create policy "Admin deletes audit logs" on public.audit_logs
  for delete using (public.is_admin());

drop policy if exists "Admin reads deletion log" on public.admin_deletions;
create policy "Admin reads deletion log" on public.admin_deletions
  for select using (public.is_admin());

-- ── PROTECT THE ADMIN ACCOUNT — cannot be deleted, ever ──────────────────────
-- Blocks admin-delete-user, self-service delete-account, dashboard deletes,
-- and raw SQL DELETE alike — this runs inside Postgres itself.
create or replace function public.protect_admin_account()
returns trigger as $$
begin
  if old.email = 'admin@xn--bliglmd-e1a.se' then
    raise exception 'The admin account cannot be deleted';
  end if;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists prevent_admin_deletion on auth.users;
create trigger prevent_admin_deletion
  before delete on auth.users
  for each row execute procedure public.protect_admin_account();

-- ── NEW: stale request drill-down (individual rows, not just a count) ───────
create or replace function admin_stale_requests(stale_days int default 30, limit_n int default 50)
returns table(
  id           uuid,
  user_email   text,
  company_name text,
  status       text,
  created_at   timestamptz
)
language sql stable security definer
set search_path = public as $$
  select id, user_email, company_name, status::text, created_at
  from public.requests
  where status in ('pending', 'sent')
    and created_at < now() - (stale_days || ' days')::interval
  order by created_at asc
  limit limit_n;
$$;

-- ── NEW: week-over-week trend per company (top N by volume) ─────────────────
create or replace function admin_company_trends(limit_n int default 10)
returns table(
  company_name    text,
  cnt_this_week   bigint,
  cnt_last_week   bigint,
  cnt_all_time    bigint
)
language sql stable security definer
set search_path = public as $$
  select
    company_name,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint as cnt_this_week,
    count(*) filter (
      where created_at >= now() - interval '14 days'
        and created_at < now() - interval '7 days'
    )::bigint as cnt_last_week,
    count(*)::bigint as cnt_all_time
  from public.requests
  group by company_name
  order by cnt_all_time desc
  limit limit_n;
$$;
