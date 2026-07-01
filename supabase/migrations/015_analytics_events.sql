-- ── FIRST-PARTY ANALYTICS — pageviews, referrer/UTM, funnel events ──────────
-- No cookies, no third-party script, no cross-site identifiers. session_id is
-- a random value generated client-side and stored in sessionStorage only
-- (cleared when the browser tab closes) — it groups events within one visit,
-- it does not persist across visits or identify a person across sessions.
create table public.analytics_events (
  id              uuid default gen_random_uuid() primary key,
  session_id      text not null,
  user_id         uuid references auth.users(id) on delete set null,
  event_type      text not null check (event_type in (
                    'pageview', 'exit', 'search_no_match',
                    'scan_completed', 'signup_started', 'signup_completed',
                    'checkout_started', 'checkout_completed', 'request_sent'
                  )),
  path            text check (length(path) <= 500),
  referrer        text check (length(referrer) <= 500),
  referrer_domain text check (length(referrer_domain) <= 255),
  utm_source      text check (length(utm_source) <= 100),
  utm_medium      text check (length(utm_medium) <= 100),
  utm_campaign    text check (length(utm_campaign) <= 100),
  lang            text check (length(lang) <= 5),
  search_term     text check (length(search_term) <= 200),
  metadata        jsonb default '{}',
  created_at      timestamptz default now() not null
);

create index analytics_events_created_at_idx  on public.analytics_events (created_at);
create index analytics_events_session_id_idx  on public.analytics_events (session_id);
create index analytics_events_event_type_idx  on public.analytics_events (event_type);

alter table public.analytics_events enable row level security;

-- Anonymous visitors must be able to log events before they ever sign up —
-- this is a public, insert-only endpoint. CHECK constraints above bound the
-- size of every field to stop a single row from being used to smuggle data;
-- the cleanup job below bounds total volume over time.
create policy "Anyone can log analytics events" on public.analytics_events
  for insert with check (true);

create policy "Admin reads analytics events" on public.analytics_events
  for select using (public.is_admin());

-- ── PG_CRON: retention — keep 90 days of traffic data ────────────────────────
select cron.schedule(
  'cleanup-analytics-events',
  '0 4 * * *',
  $$delete from public.analytics_events where created_at < now() - interval '90 days';$$
);

-- ── RPCs for the admin Trafik tab ─────────────────────────────────────────────

-- Referrer domains driving traffic (first pageview of each session only)
create or replace function admin_traffic_referrers(days_back int default 30, limit_n int default 15)
returns table(referrer_domain text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select coalesce(nullif(referrer_domain, ''), 'Direkt/okänd') as referrer_domain, count(*)::bigint as cnt
  from public.analytics_events
  where event_type = 'pageview'
    and created_at >= now() - (days_back || ' days')::interval
    and metadata->>'is_landing' = 'true'
  group by 1
  order by cnt desc
  limit limit_n;
$$;

-- Top landing pages (first pageview of each session)
create or replace function admin_traffic_landing_pages(days_back int default 30, limit_n int default 10)
returns table(path text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select path, count(*)::bigint as cnt
  from public.analytics_events
  where event_type = 'pageview'
    and created_at >= now() - (days_back || ' days')::interval
    and metadata->>'is_landing' = 'true'
  group by path
  order by cnt desc
  limit limit_n;
$$;

-- Top exit pages
create or replace function admin_traffic_exit_pages(days_back int default 30, limit_n int default 10)
returns table(path text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select path, count(*)::bigint as cnt
  from public.analytics_events
  where event_type = 'exit'
    and created_at >= now() - (days_back || ' days')::interval
  group by path
  order by cnt desc
  limit limit_n;
$$;

-- Funnel: distinct sessions/users reaching each milestone (all-time — small volume, no need to window)
create or replace function admin_traffic_funnel()
returns table(event_type text, distinct_sessions bigint)
language sql stable security definer
set search_path = public as $$
  select event_type, count(distinct session_id)::bigint as distinct_sessions
  from public.analytics_events
  where event_type in ('pageview', 'scan_completed', 'signup_completed', 'checkout_completed', 'request_sent')
  group by event_type;
$$;

-- Company searches that returned zero results — direct product-roadmap signal
create or replace function admin_traffic_unmatched_searches(days_back int default 90, limit_n int default 30)
returns table(search_term text, cnt bigint, last_searched timestamptz)
language sql stable security definer
set search_path = public as $$
  select search_term, count(*)::bigint as cnt, max(created_at) as last_searched
  from public.analytics_events
  where event_type = 'search_no_match'
    and created_at >= now() - (days_back || ' days')::interval
    and search_term is not null
    and length(trim(search_term)) > 0
  group by search_term
  order by cnt desc, last_searched desc
  limit limit_n;
$$;

-- Language split (from pageview events)
create or replace function admin_traffic_lang_split(days_back int default 30)
returns table(lang text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select coalesce(lang, 'okänt') as lang, count(*)::bigint as cnt
  from public.analytics_events
  where event_type = 'pageview'
    and created_at >= now() - (days_back || ' days')::interval
    and metadata->>'is_landing' = 'true'
  group by 1;
$$;
