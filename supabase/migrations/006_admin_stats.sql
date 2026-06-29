-- ── ADMIN ANALYTICS FUNCTIONS ─────────────────────────────────────────────────
-- All functions use SECURITY DEFINER so the service-role edge function can call
-- them via client.rpc() without needing raw table grants.

-- New signups per day (last N days) — from profiles which is 1:1 with auth.users
create or replace function admin_signups_per_day(days_back int default 30)
returns table(day date, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select created_at::date as day, count(*)::bigint as cnt
  from public.profiles
  where created_at >= now() - (days_back || ' days')::interval
  group by created_at::date
  order by day;
$$;

-- Requests created per day (last N days)
create or replace function admin_requests_per_day(days_back int default 30)
returns table(day date, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select created_at::date as day, count(*)::bigint as cnt
  from public.requests
  where created_at >= now() - (days_back || ' days')::interval
  group by created_at::date
  order by day;
$$;

-- Scans per day (last N days)
create or replace function admin_scans_per_day(days_back int default 30)
returns table(day date, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select created_at::date as day, count(*)::bigint as cnt
  from public.scans
  where created_at >= now() - (days_back || ' days')::interval
  group by created_at::date
  order by day;
$$;

-- Top companies by all-time request count
create or replace function admin_top_companies(limit_n int default 10)
returns table(company_name text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select company_name, count(*)::bigint as cnt
  from public.requests
  group by company_name
  order by cnt desc
  limit limit_n;
$$;

-- Request status breakdown (all time)
create or replace function admin_request_statuses()
returns table(status text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select status::text, count(*)::bigint as cnt
  from public.requests
  group by status
  order by cnt desc;
$$;

-- Breach stats across all scans
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
  from public.scans;
$$;

-- Active (pending/sent) and stale (no reply > N days) request counts
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
  from public.requests;
$$;

-- Fastest-responding companies (confirmed only, min 2 data points)
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
  group by company_name
  having count(*) >= 2
  order by avg_days asc
  limit limit_n;
$$;
