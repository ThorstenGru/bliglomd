-- Fix: derive exit pages from the last pageview per session rather than a
-- separate 'exit' beacon event. navigator.sendBeacon() can't carry Supabase's
-- required apikey header cleanly, and unload events are notoriously
-- unreliable across browsers/mobile anyway — last-pageview-per-session is the
-- standard, more robust way analytics tools compute this.
create or replace function admin_traffic_exit_pages(days_back int default 30, limit_n int default 10)
returns table(path text, cnt bigint)
language sql stable security definer
set search_path = public as $$
  with last_pageview as (
    select distinct on (session_id) session_id, path
    from public.analytics_events
    where event_type = 'pageview'
      and created_at >= now() - (days_back || ' days')::interval
    order by session_id, created_at desc
  )
  select path, count(*)::bigint as cnt
  from last_pageview
  group by path
  order by cnt desc
  limit limit_n;
$$;
