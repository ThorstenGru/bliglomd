-- Found live 2026-09-30 during the admin panel walkthrough: only
-- admin_signups_per_day (migration 019) was ever fixed to exclude the admin
-- account from its own numbers. Every other product-usage analytics function
-- -- requests/scans per day, top companies, request status breakdown, breach
-- stats, active/stale counts, response times, stale-request drill-down,
-- company trends -- still aggregates public.requests/public.scans with no
-- exclusion at all. Since the admin account now intentionally carries a real
-- paid tier so the founder can use the product himself (see admin-stats.ts
-- fix, same session), every one of his own scans/requests silently pollutes
-- these "real customer activity" numbers indefinitely, the same class of bug
-- as the MRR leak just fixed in admin-stats -- just spread across nine SQL
-- functions instead of one edge function.

create or replace function admin_requests_per_day(days_back int default 30)
returns table(day date, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select created_at::date as day, count(*)::bigint as cnt
  from public.requests
  where created_at >= now() - (days_back || ' days')::interval
    and user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se')
  group by created_at::date
  order by day;
$$;

create or replace function admin_scans_per_day(days_back int default 30)
returns table(day date, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select created_at::date as day, count(*)::bigint as cnt
  from public.scans
  where created_at >= now() - (days_back || ' days')::interval
    and user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se')
  group by created_at::date
  order by day;
$$;

create or replace function admin_top_companies(limit_n int default 10)
returns table(company_name text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select company_name, count(*)::bigint as cnt
  from public.requests
  where user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se')
  group by company_name
  order by cnt desc
  limit limit_n;
$$;

create or replace function admin_request_statuses()
returns table(status text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select status::text, count(*)::bigint as cnt
  from public.requests
  where user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se')
  group by status
  order by cnt desc;
$$;

create or replace function admin_breach_stats()
returns table(
  total_scans       bigint,
  total_breaches    bigint,
  avg_breaches      numeric,
  scans_with_breach bigint
)
language sql stable security definer
set search_path = public as $$
  select
    count(*)::bigint,
    coalesce(sum(breach_count), 0)::bigint,
    round(coalesce(avg(breach_count), 0), 1),
    count(*) filter (where breach_count > 0)::bigint
  from public.scans
  where user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se');
$$;

create or replace function admin_active_and_stale(stale_days int default 30)
returns table(active_cnt bigint, stale_cnt bigint)
language sql stable security definer
set search_path = public as $$
  select
    count(*) filter (where status in ('pending', 'sent'))::bigint as active_cnt,
    count(*) filter (
      where status in ('pending', 'sent')
        and created_at < now() - (stale_days || ' days')::interval
    )::bigint as stale_cnt
  from public.requests
  where user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se');
$$;

create or replace function admin_response_times(limit_n int default 10)
returns table(company_name text, avg_days numeric, total_confirmed bigint)
language sql stable security definer
set search_path = public as $$
  select
    company_name,
    round(avg(extract(epoch from (response_at - sent_at)) / 86400.0), 1) as avg_days,
    count(*)::bigint as total_confirmed
  from public.requests
  where status = 'confirmed'
    and sent_at is not null
    and response_at is not null
    and response_at > sent_at
    and user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se')
  group by company_name
  having count(*) >= 2
  order by avg_days asc
  limit limit_n;
$$;

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
    and user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se')
  order by created_at asc
  limit limit_n;
$$;

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
  where user_id <> (select id from auth.users where email = 'admin@xn--bliglmd-e1a.se')
  group by company_name
  order by cnt_all_time desc
  limit limit_n;
$$;
