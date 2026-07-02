-- The admin account is already excluded from the "Totalt registrerade" headline
-- stat (admin-stats/index.ts filters it out of allUsers), but the raw SQL RPC
-- behind the "Registreringar per dag" chart reads straight from public.profiles
-- and never applied the same exclusion, so the admin's own signup date still
-- shows up as a data point on the chart.
create or replace function admin_signups_per_day(days_back int default 30)
returns table(day date, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select p.created_at::date as day, count(*)::bigint as cnt
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.created_at >= now() - (days_back || ' days')::interval
    and u.email <> 'admin@xn--bliglmd-e1a.se'
  group by p.created_at::date
  order by day;
$$;
