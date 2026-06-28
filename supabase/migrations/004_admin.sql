-- ── GRANSKNINGSLOGG (rullande 30 dagar) ──────────────────────────────────────
create table public.audit_logs (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete set null,
  user_email  text,
  action      text        not null,
  resource    text,
  metadata    jsonb       default '{}',
  created_at  timestamptz default now() not null
);

create index audit_logs_created_at_idx on public.audit_logs (created_at);
create index audit_logs_user_id_idx    on public.audit_logs (user_id);

alter table public.audit_logs enable row level security;

-- Inloggad användare kan logga sina egna händelser
create policy "Users can insert own audit events" on public.audit_logs
  for insert with check (auth.uid() = user_id or user_id is null);

-- Bara admin kan läsa
create policy "Admin reads audit logs" on public.audit_logs
  for select using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admin kan radera (behövs för pg_cron-cleanup)
create policy "Admin deletes audit logs" on public.audit_logs
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );


-- ── ADMINRADERINGSRAPPORTER (permanenta) ─────────────────────────────────────
create table public.admin_deletions (
  id                   uuid        default gen_random_uuid() primary key,
  deleted_user_id      uuid        not null,
  deleted_user_email   text        not null,
  deleted_by_email     text        not null,
  snapshot             jsonb       not null default '{}',
  created_at           timestamptz default now() not null
);

alter table public.admin_deletions enable row level security;

create policy "Admin reads deletion log" on public.admin_deletions
  for select using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );


-- ── PG_CRON: AUTO-RENSA GRANSKNINGSLOGG ──────────────────────────────────────
select cron.schedule(
  'cleanup-audit-logs',
  '0 3 * * *',
  $$delete from public.audit_logs where created_at < now() - interval '30 days';$$
);
