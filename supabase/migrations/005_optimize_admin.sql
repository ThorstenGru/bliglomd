-- ── FIX: audit_logs INSERT policy allowed unauthenticated DoS ────────────────
-- The original policy had `or user_id is null` which let any anonymous caller
-- insert unlimited rows with user_id = NULL (anon key is public in the SPA).
-- Edge functions use the service-role client (bypasses RLS), so they are unaffected.
drop policy if exists "Users can insert own audit events" on public.audit_logs;

create policy "Users can insert own audit events" on public.audit_logs
  for insert with check (auth.uid() = user_id and auth.uid() is not null);


-- ── ADD: aggregate count functions for efficient admin panel listing ──────────
-- Replaces full table scans (one row per event) with one row per user.
-- Used by supabase/functions/admin-list-users via client.rpc('admin_request_counts').
create or replace function admin_request_counts()
returns table(user_id uuid, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select user_id, count(*)::bigint as cnt from public.requests group by user_id;
$$;

create or replace function admin_scan_counts()
returns table(user_id uuid, cnt bigint)
language sql stable security definer
set search_path = public as $$
  select user_id, count(*)::bigint as cnt from public.scans group by user_id;
$$;
