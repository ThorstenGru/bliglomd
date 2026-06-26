-- Aktivera UUID-extension
create extension if not exists "uuid-ossp";

-- Användarnivåer (utökar Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  level integer default 1 check (level in (1,2,3)),
  created_at timestamptz default now()
);

-- RLS på profiles
alter table public.profiles enable row level security;
create policy "Användare ser bara sin egen profil"
  on public.profiles for all
  using (auth.uid() = id);

-- Trigger: skapa profil automatiskt vid registrering
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Raderingsförfrågningar
create table public.requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id text not null,
  company_name text not null,
  user_email text not null,
  user_name text not null,
  status text default 'pending'
    check (status in ('pending','sent','confirmed','removed','failed','expired')),
  sent_at timestamptz,
  response_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

alter table public.requests enable row level security;
create policy "Användare hanterar bara sina egna förfrågningar"
  on public.requests for all
  using (auth.uid() = user_id);

-- E-postskärningar (HIBP-skanningar)
create table public.scans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  scan_email text not null,
  hibp_breaches jsonb default '[]',
  category_suggestions jsonb default '[]',
  created_at timestamptz default now()
);

alter table public.scans enable row level security;
create policy "Användare ser bara sina egna skanningar"
  on public.scans for all
  using (auth.uid() = user_id);

-- Påminnelser (L3)
create table public.reminders (
  id uuid default uuid_generate_v4() primary key,
  request_id uuid references public.requests(id) on delete cascade not null,
  scheduled_at timestamptz not null,
  sent boolean default false
);

alter table public.reminders enable row level security;
create policy "Användare ser påminnelser för sina förfrågningar"
  on public.reminders for all
  using (
    auth.uid() = (
      select user_id from public.requests where id = request_id
    )
  );
