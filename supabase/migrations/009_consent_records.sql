-- Consent records: tracks every user's explicit agreement to T&C at checkout
create table public.consent_records (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  consented_at    timestamptz default now() not null,
  terms_version   text not null,
  terms_snapshot  text not null,    -- full text of terms accepted (immutable record)
  consent_text    text not null,    -- exact checkbox label the user ticked
  price_id        text not null,
  user_agent      text,
  consent_context text not null default 'checkout'
);

alter table public.consent_records enable row level security;

create policy "Users insert their own consent"
  on public.consent_records for insert
  with check (auth.uid() = user_id);

create policy "Users read their own consent"
  on public.consent_records for select
  using (auth.uid() = user_id);

-- Admin can read all via service role (bypasses RLS)
