-- analytics_events accepted unrestricted, spoofable writes: any unauthenticated
-- caller could POST directly to the REST API with an arbitrary user_id (identity
-- spoofing against a real user) since the INSERT policy was WITH CHECK (true).
-- The app itself always sends user_id: user?.id ?? null (src/lib/analytics.ts:36),
-- so this tightens the policy to match actual legitimate usage exactly: an
-- anonymous visitor may only write a null user_id, a logged-in user only their own.
drop policy if exists "Anyone can log analytics events" on public.analytics_events;
create policy "Log analytics events as self or anonymous"
  on public.analytics_events for insert
  with check (
    (user_id is null and auth.uid() is null) or auth.uid() = user_id
  );

-- audit_logs: a policy letting any authenticated user INSERT their own row was
-- dead code (every real write goes through service-role edge functions), but
-- its existence meant any signed-up user could inject fabricated entries into
-- what the admin dashboard treats as the ground-truth compliance/audit trail
-- (Admin.tsx cross-matches action/metadata from this table). Dropping it --
-- writes now only happen via service-role code, which bypasses RLS entirely
-- and needs no policy.
drop policy if exists "Users can insert own audit events" on public.audit_logs;
