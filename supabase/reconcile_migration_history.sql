-- Reconcile supabase_migrations.schema_migrations bookkeeping with reality.
-- Authorized by Thorsten 2026-09-30. Pure bookkeeping -- no schema/data changes.
insert into supabase_migrations.schema_migrations (version, name, statements) values ('004', 'admin', ARRAY[$mig004body$-- ── GRANSKNINGSLOGG (rullande 30 dagar) ──────────────────────────────────────
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
$mig004body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('005', 'optimize_admin', ARRAY[$mig005body$-- ── FIX: audit_logs INSERT policy allowed unauthenticated DoS ────────────────
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
$mig005body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('006', 'admin_stats', ARRAY[$mig006body$-- ── ADMIN ANALYTICS FUNCTIONS ─────────────────────────────────────────────────
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
$mig006body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('007', 'weekly_digest_cron', ARRAY[$mig007body$-- ── WEEKLY ADMIN DIGEST — pg_cron + pg_net schedule ──────────────────────────
-- Calls the admin-weekly-digest edge function every Monday at 07:00 UTC.
-- DIGEST_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'digest-secret', '...');
-- and as an edge function env via:
--   supabase secrets set DIGEST_SECRET=<uuid>

select cron.schedule(
  'admin-weekly-digest',
  '0 7 * * 1',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/admin-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'digest-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
$mig007body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('008', 'stripe_subscriptions', ARRAY[$mig008body$-- Stripe subscription fields on profiles
alter table public.profiles
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status    text not null default 'inactive';

-- Fast lookup from webhook (customer.* events arrive with customer ID only)
create index if not exists idx_profiles_stripe_customer
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.profiles.stripe_customer_id     is 'Stripe cus_xxx — set on first checkout';
comment on column public.profiles.stripe_subscription_id is 'Stripe sub_xxx — set on checkout.session.completed';
comment on column public.profiles.subscription_status    is 'inactive | active | past_due | canceled';
$mig008body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('009', 'consent_records', ARRAY[$mig009body$-- Consent records: tracks every user's explicit agreement to T&C at checkout
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
$mig009body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('010', 'signup_consent', ARRAY[$mig010body$-- Signup consent: tracks every user's explicit agreement to Terms + Privacy at account creation.
-- Kept separate from consent_records (checkout-specific — has a required price_id).
create table public.signup_consent_records (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  consented_at     timestamptz default now() not null,
  terms_version    text not null,
  terms_snapshot   text not null,    -- full text of Terms of Service accepted (immutable record)
  privacy_version  text not null,
  privacy_snapshot text not null,    -- full text of Privacy Policy accepted (immutable record)
  consent_text     text not null     -- exact checkbox label the user ticked
);

alter table public.signup_consent_records enable row level security;

create policy "Users read their own signup consent"
  on public.signup_consent_records for select
  using (auth.uid() = user_id);

-- No insert policy: rows are only ever written by the trigger below (security definer),
-- never directly by the client — there is no session yet at signup time to satisfy auth.uid().

-- Trigger: record consent atomically with account creation, and BLOCK account creation
-- if consent wasn't given. Signup_consent_text/version are passed via signUp() options.data,
-- but the actual accepted text is always the current server-side snapshot below — never
-- trusted from the client — so the record can't be tampered with.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-06-30-v1',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. PARTER
Tjänsten BliGlömd tillhandahålls av Thorsten Grund, enskild firma (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: support@bliglomd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis eller årsvis. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. INGEN ÅTERBETALNING
Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av Tjänsteleverantören.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
e) Om Kunden är missnöjd med tjänstens resultat eller funktion.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Stockholms tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-06-30-v1',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd (Thorsten Grund, enskild firma) är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: support@bliglomd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering och köp.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Resend Inc. (transaktionell e-post, EU-datahantering). Alla biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år enligt Bokföringslagen. Samtyckesloggar: 7 år (bevis för avtalsslut). Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta support@bliglomd.se för att utöva dina rättigheter.

7. KAKOR (COOKIES)
BliGlömd använder strikt nödvändiga sessionscookies som sätts av Supabase för autentisering. Dessa cookies krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK). Inga reklam- eller spårningscookies används.

8. KONTAKT
För dataskyddsfrågor: support@bliglomd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created_signup_consent
  after insert on auth.users
  for each row execute procedure public.handle_new_user_signup_consent();
$mig010body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('011', 'cleanup_unconfirmed_cron', ARRAY[$mig011body$-- ── CLEANUP UNCONFIRMED ACCOUNTS — pg_cron + pg_net schedule ─────────────────
-- Calls the cleanup-unconfirmed edge function every 5 minutes. It deletes any
-- auth.users row that is still unconfirmed 10+ minutes after signup — the
-- confirmation email link (also set to expire at 10 min) and the account
-- lifetime are kept in lockstep.
-- CLEANUP_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'cleanup-secret', '...');
-- and as an edge function env via:
--   supabase secrets set CLEANUP_SECRET=<uuid>

select cron.schedule(
  'cleanup-unconfirmed-accounts',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/cleanup-unconfirmed',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'cleanup-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
$mig011body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('012', 'fix_signup_consent_contact_email', ARRAY[$mig012body$-- Fix: support@bliglomd.se was never a real mailbox (wrong domain — missing the
-- ö, and that plain-ASCII domain isn't even the one BliGlömd owns). Corrects the
-- snapshot text recorded by the signup consent trigger going forward.
-- Does not touch existing signup_consent_records rows — those remain an accurate
-- historical record of what was actually shown at the time.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-06-30-v1',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. PARTER
Tjänsten BliGlömd tillhandahålls av Thorsten Grund, enskild firma (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis eller årsvis. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. INGEN ÅTERBETALNING
Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av Tjänsteleverantören.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
e) Om Kunden är missnöjd med tjänstens resultat eller funktion.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Stockholms tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-06-30-v1',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd (Thorsten Grund, enskild firma) är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering och köp.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Resend Inc. (transaktionell e-post, EU-datahantering). Alla biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år enligt Bokföringslagen. Samtyckesloggar: 7 år (bevis för avtalsslut). Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR (COOKIES)
BliGlömd använder strikt nödvändiga sessionscookies som sätts av Supabase för autentisering. Dessa cookies krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK). Inga reklam- eller spårningscookies används.

8. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
$mig012body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('013', 'fix_signup_consent_venue', ARRAY[$mig013body$-- Fix: exclusive forum changed from Stockholms tingsrätt to Helsingborgs tingsrätt.
-- Does not touch existing signup_consent_records rows — those remain an accurate
-- historical record of what was actually shown at the time.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-06-30-v1',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. PARTER
Tjänsten BliGlömd tillhandahålls av Thorsten Grund, enskild firma (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis eller årsvis. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. INGEN ÅTERBETALNING
Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av Tjänsteleverantören.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
e) Om Kunden är missnöjd med tjänstens resultat eller funktion.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-06-30-v1',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd (Thorsten Grund, enskild firma) är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering och köp.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Resend Inc. (transaktionell e-post, EU-datahantering). Alla biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år enligt Bokföringslagen. Samtyckesloggar: 7 år (bevis för avtalsslut). Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR (COOKIES)
BliGlömd använder strikt nödvändiga sessionscookies som sätts av Supabase för autentisering. Dessa cookies krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK). Inga reklam- eller spårningscookies används.

8. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
$mig013body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('014', 'admin_security_and_features', ARRAY[$mig014body$-- ── SECURITY FIX: admin gating must not rely on user_metadata.role alone ─────
-- user_metadata is self-editable by ANY logged-in user via
-- supabase.auth.updateUser({ data: { role: 'admin' } }) from the browser
-- console — role alone was never a safe authorization boundary. Every RLS
-- policy that previously checked only role now also requires the exact
-- admin email. Edge functions get the equivalent fix in the same deploy.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public as $$
  select (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
     and (auth.jwt() ->> 'email') = 'admin@xn--bliglmd-e1a.se';
$$;

drop policy if exists "Admin reads audit logs" on public.audit_logs;
create policy "Admin reads audit logs" on public.audit_logs
  for select using (public.is_admin());

drop policy if exists "Admin deletes audit logs" on public.audit_logs;
create policy "Admin deletes audit logs" on public.audit_logs
  for delete using (public.is_admin());

drop policy if exists "Admin reads deletion log" on public.admin_deletions;
create policy "Admin reads deletion log" on public.admin_deletions
  for select using (public.is_admin());

-- ── PROTECT THE ADMIN ACCOUNT — cannot be deleted, ever ──────────────────────
-- Blocks admin-delete-user, self-service delete-account, dashboard deletes,
-- and raw SQL DELETE alike — this runs inside Postgres itself.
create or replace function public.protect_admin_account()
returns trigger as $$
begin
  if old.email = 'admin@xn--bliglmd-e1a.se' then
    raise exception 'The admin account cannot be deleted';
  end if;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists prevent_admin_deletion on auth.users;
create trigger prevent_admin_deletion
  before delete on auth.users
  for each row execute procedure public.protect_admin_account();

-- ── NEW: stale request drill-down (individual rows, not just a count) ───────
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
  order by created_at asc
  limit limit_n;
$$;

-- ── NEW: week-over-week trend per company (top N by volume) ─────────────────
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
  group by company_name
  order by cnt_all_time desc
  limit limit_n;
$$;
$mig014body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('015', 'analytics_events', ARRAY[$mig015body$-- ── FIRST-PARTY ANALYTICS — pageviews, referrer/UTM, funnel events ──────────
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
$mig015body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('016', 'analytics_exit_pages_fix', ARRAY[$mig016body$-- Fix: derive exit pages from the last pageview per session rather than a
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
$mig016body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('017', 'privacy_v2_analytics_disclosure', ARRAY[$mig017body$-- Privacy policy bumped to v2 to disclose the new first-party analytics
-- (referrer/UTM, pageviews, unmatched company searches — see analytics_events
-- table, migration 015). Terms of Service is unchanged, still 2026-06-30-v1.
-- Does not touch existing signup_consent_records rows — those remain an
-- accurate historical record of what was actually shown at the time.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-06-30-v1',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. PARTER
Tjänsten BliGlömd tillhandahålls av Thorsten Grund, enskild firma (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis eller årsvis. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. INGEN ÅTERBETALNING
Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av Tjänsteleverantören.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
e) Om Kunden är missnöjd med tjänstens resultat eller funktion.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-07-01-v2',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-07-01-v2
Gäller fr.o.m. 2026-07-01

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd (Thorsten Grund, enskild firma) är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering och köp. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Resend Inc. (transaktionell e-post, EU-datahantering). Alla biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §. Samtyckesloggar: 7 år (bevis för avtalsslut). Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
$mig017body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('018', 'privacy_v3_brevo_processor', ARRAY[$mig018body$-- Privacy policy bumped to v3: Resend Inc. replaced with Brevo SAS as the
-- transactional email sub-processor (BliGlömd switched providers). This is a
-- factual change to who processes data, not a wording fix — Terms of Service
-- is unchanged, still 2026-06-30-v1.
-- Does not touch existing signup_consent_records rows — those remain an
-- accurate historical record of what was actually shown at the time.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-06-30-v1',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. PARTER
Tjänsten BliGlömd tillhandahålls av Thorsten Grund, enskild firma (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis eller årsvis. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. INGEN ÅTERBETALNING
Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av Tjänsteleverantören.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
e) Om Kunden är missnöjd med tjänstens resultat eller funktion.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-07-02-v3',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-07-02-v3
Gäller fr.o.m. 2026-07-02

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd (Thorsten Grund, enskild firma) är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering och köp. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). Alla biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §. Samtyckesloggar: 7 år (bevis för avtalsslut). Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
$mig018body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('019', 'exclude_admin_signups_chart', ARRAY[$mig019body$-- The admin account is already excluded from the "Totalt registrerade" headline
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
$mig019body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('020', 'privacy_v4_xposedornot_processor', ARRAY[$mig020body$-- Privacy policy bumped to v4: XposedOrNot (the breach-lookup service used by
-- scan-email) is now named explicitly in section 4, and section 3 discloses
-- that scanning relies on separately-obtained explicit consent (Art. 6(1)(a))
-- rather than being covered by an ordinary data-processing agreement, since
-- XposedOrNot discloses no legal entity or jurisdiction to sign one with.
-- Terms of Service is unchanged, still 2026-06-30-v1.
-- Does not touch existing signup_consent_records rows — those remain an
-- accurate historical record of what was actually shown at the time.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-06-30-v1',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-06-30-v1
Gäller fr.o.m. 2026-06-30

1. PARTER
Tjänsten BliGlömd tillhandahålls av Thorsten Grund, enskild firma (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis eller årsvis. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. INGEN ÅTERBETALNING
Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av Tjänsteleverantören.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
e) Om Kunden är missnöjd med tjänstens resultat eller funktion.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-07-02-v4',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-07-02-v4
Gäller fr.o.m. 2026-07-02

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd (Thorsten Grund, enskild firma) är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat — se avsnitt 4 om XposedOrNot. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering, köp och skanning. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att söka i XposedOrNots dataintrångsdatabas (uttryckligt samtycke, Art. 6(1)(a), inhämtat separat inför varje skanning). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). XposedOrNot (sökning mot databas för läckta uppgifter vid e-postskanning) — leverantören anger i sin egen policy att sökningar behandlas endast i minnet och inte lagras, men offentliggör inget bolagsnamn eller jurisdiktion, varför vi inhämtar ditt uttryckliga samtycke separat inför varje skanning istället för att behandla dem som ett vanligt personuppgiftsbiträde. Alla övriga biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §. Samtyckesloggar: 7 år (bevis för avtalsslut). Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
$mig020body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('021', 'terms_v2_privacy_v5_remove_personal_name', ARRAY[$mig021body$-- Terms bumped to v2, Privacy bumped to v5: removes the founder's personal
-- name ("Thorsten Grund, enskild firma") from the contracting-party (§1) and
-- data-controller (§1) clauses -- BliGlömd is now identified by the business
-- name alone, with kontakt@bliglömd.se as the sole contact point. Also fixes
-- Terms §3 to reflect monthly-only billing (annual pricing was dropped).
-- Does not touch existing signup_consent_records rows -- those remain an
-- accurate historical record of what was actually shown at the time.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-09-24-v2',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-09-24-v2
Gäller fr.o.m. 2026-09-24

1. PARTER
Tjänsten BliGlömd tillhandahålls av BliGlömd (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis. Abonnemang kan sägas upp när som helst utan bindningstid. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. INGEN ÅTERBETALNING
Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av Tjänsteleverantören.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
e) Om Kunden är missnöjd med tjänstens resultat eller funktion.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-09-24-v5',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-09-24-v5
Gäller fr.o.m. 2026-09-24

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat — se avsnitt 4 om XposedOrNot. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering, köp och skanning. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att söka i XposedOrNots dataintrångsdatabas (uttryckligt samtycke, Art. 6(1)(a), inhämtat separat inför varje skanning). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). XposedOrNot (sökning mot databas för läckta uppgifter vid e-postskanning) — leverantören anger i sin egen policy att sökningar behandlas endast i minnet och inte lagras, men offentliggör inget bolagsnamn eller jurisdiktion, varför vi inhämtar ditt uttryckliga samtycke separat inför varje skanning istället för att behandla dem som ett vanligt personuppgiftsbiträde. Alla övriga biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §. Samtyckesloggar: 7 år (bevis för avtalsslut). Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
$mig021body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('022', 'terms_v3_privacy_v6_entity_and_refunds', ARRAY[$mig022body$-- Terms bumped to v3, Privacy bumped to v6:
-- 1. Correctly identifies the operating legal entity as Lykkebo Fastigheter
--    Kommanditbolag (the entity actually registered on the Stripe account)
--    instead of the previously-stated "enskild firma", which did not match.
-- 2. Softens the blanket no-refund clause (Terms section 5): still no refund
--    for change of mind / dissatisfaction with results where the service was
--    delivered per section 2, but now carves out a refund right when
--    BliGlömd itself fails to deliver the paid service's core function due
--    to a fault entirely on BliGlömd's side (e.g. a paid subscription that
--    never activated) -- a blanket "no refunds under any circumstances"
--    clause covering the trader's own non-performance is a real unfair-term
--    risk under Swedish/EU consumer law, distinct from the (correctly
--    implemented) 14-day withdrawal-right waiver for immediate digital
--    delivery, which is unaffected by this change.
-- Does not touch existing signup_consent_records rows -- those remain an
-- accurate historical record of what was actually shown at the time.
create or replace function public.handle_new_user_signup_consent()
returns trigger as $$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-09-25-v3',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-09-25-v3
Gäller fr.o.m. 2026-09-25

1. PARTER
Tjänsten BliGlömd tillhandahålls av Lykkebo Fastigheter Kommanditbolag (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis. Abonnemang kan sägas upp när som helst utan bindningstid. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. ÅTERBETALNING
Betalningar är i regel slutgiltiga och återbetalas inte. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om Kunden är missnöjd med tjänstens resultat eller funktion, förutsatt att tjänsten levererats i enlighet med avsnitt 2.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden i dessa fall.

Undantag — utebliven leverans: Om Tjänsteleverantören på grund av ett tekniskt fel eller annat förhållande som helt beror på Tjänsteleverantören inte har levererat den betalda tjänstens kärnfunktion alls (till exempel att ett betalt abonnemang aldrig aktiverades), har Kunden rätt att inom skälig tid begära återbetalning för den period felet avsåg. Undantaget gäller inte fel som beror på omständigheter utanför Tjänsteleverantörens kontroll (t.ex. tredje parts system) eller när tjänsten i övrigt fungerat enligt avsnitt 2 (bästa ansträngning, inga garanterade resultat).

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-09-25-v6',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-09-25-v6
Gäller fr.o.m. 2026-09-25

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd, som drivs av Lykkebo Fastigheter Kommanditbolag, är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat — se avsnitt 4 om XposedOrNot. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering, köp och skanning. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att söka i XposedOrNots dataintrångsdatabas (uttryckligt samtycke, Art. 6(1)(a), inhämtat separat inför varje skanning). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). XposedOrNot (sökning mot databas för läckta uppgifter vid e-postskanning) — leverantören anger i sin egen policy att sökningar behandlas endast i minnet och inte lagras, men offentliggör inget bolagsnamn eller jurisdiktion, varför vi inhämtar ditt uttryckliga samtycke separat inför varje skanning istället för att behandla dem som ett vanligt personuppgiftsbiträde. Alla övriga biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §. Samtyckesloggar: 7 år (bevis för avtalsslut). Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
$mig022body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('023', 'admin_schema_snapshot_rpc', ARRAY[$mig023body$-- Returns every public-schema base table with its column list, in declaration order.
-- Used by admin-weekly-db-dump so the export stays exhaustive as the schema evolves,
-- and so empty tables still get a correct CSV header.
create or replace function public.admin_schema_snapshot()
returns table(table_name text, columns text[])
language sql
security definer
set search_path = public
as $$
  select c.table_name, array_agg(c.column_name order by c.ordinal_position)
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
  group by c.table_name
  order by c.table_name;
$$;

revoke all on function public.admin_schema_snapshot() from public;
grant execute on function public.admin_schema_snapshot() to service_role;
$mig023body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('024', 'monthly_report_and_db_dump_cron', ARRAY[$mig024body$-- ── MONTHLY STRIPE PURCHASE REPORT — pg_cron + pg_net schedule ────────────────
-- Calls admin-monthly-report on the 1st of every month at 07:00 UTC, reporting
-- on the previous calendar month's paid Stripe invoices (live mode).
-- MONTHLY_REPORT_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'monthly-report-secret', '...');
-- and as an edge function env via:
--   supabase secrets set MONTHLY_REPORT_SECRET=<uuid>

select cron.schedule(
  'admin-monthly-report',
  '0 7 1 * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/admin-monthly-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'monthly-report-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- ── WEEKLY DB DUMP — pg_cron + pg_net schedule ─────────────────────────────────
-- Calls admin-weekly-db-dump every Sunday at 06:00 UTC (staggered an hour ahead
-- of the Monday 07:00 weekly digest). Exports every public-schema table as a
-- zipped set of CSVs (auth schema is intentionally excluded — see function).
-- DB_DUMP_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'db-dump-secret', '...');
-- and as an edge function env via:
--   supabase secrets set DB_DUMP_SECRET=<uuid>

select cron.schedule(
  'admin-weekly-db-dump',
  '0 6 * * 0',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/admin-weekly-db-dump',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'db-dump-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
$mig024body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('025', 'send_reminders_auth', ARRAY[$mig025body$-- send-reminders was deployed with gateway JWT enforcement off (correct, since
-- pg_cron can never present a Supabase session JWT) but had NO auth check of its
-- own — the endpoint was fully open on the public internet, letting anyone spam
-- real customers with "your protection expires soon" emails and flip their
-- requests.status to 'expired' on demand. Fixed with the same Vault-secret
-- bearer pattern already used for cleanup-unconfirmed / admin-weekly-digest.
-- REMINDERS_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'reminders-secret', '...');
-- and as an edge function env via:
--   supabase secrets set REMINDERS_SECRET=<uuid>

select cron.schedule(
  'send-reminders-daily',
  '0 9 * * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'reminders-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
$mig025body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('026', 'terms_v4_privacy_v7_org_number', ARRAY[$mig026body$-- Adds the trader's registration number (required disclosure under e-handelslagen
-- 2002:562 §8) to §1 of both Terms and Privacy. Text must match src/config/terms.ts
-- exactly -- this is the DB-side snapshot taken at signup for the consent audit trail.

create or replace function public.handle_new_user_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-09-25-v4',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-09-25-v4
Gäller fr.o.m. 2026-09-25

1. PARTER
BliGlömd.se är en del av Lykkebo Fastigheter Kommanditbolag, Org.nr 969797-1647. Tjänsten BliGlömd tillhandahålls av Lykkebo Fastigheter Kommanditbolag (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis. Abonnemang kan sägas upp när som helst utan bindningstid. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. ÅTERBETALNING
Betalningar är i regel slutgiltiga och återbetalas inte. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om Kunden är missnöjd med tjänstens resultat eller funktion, förutsatt att tjänsten levererats i enlighet med avsnitt 2.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden i dessa fall.

Undantag — utebliven leverans: Om Tjänsteleverantören på grund av ett tekniskt fel eller annat förhållande som helt beror på Tjänsteleverantören inte har levererat den betalda tjänstens kärnfunktion alls (till exempel att ett betalt abonnemang aldrig aktiverades), har Kunden rätt att inom skälig tid begära återbetalning för den period felet avsåg. Undantaget gäller inte fel som beror på omständigheter utanför Tjänsteleverantörens kontroll (t.ex. tredje parts system) eller när tjänsten i övrigt fungerat enligt avsnitt 2 (bästa ansträngning, inga garanterade resultat).

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-09-25-v7',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-09-25-v7
Gäller fr.o.m. 2026-09-25

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd.se är en del av Lykkebo Fastigheter Kommanditbolag, Org.nr 969797-1647. BliGlömd, som drivs av Lykkebo Fastigheter Kommanditbolag, är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat — se avsnitt 4 om XposedOrNot. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering, köp och skanning. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att söka i XposedOrNots dataintrångsdatabas (uttryckligt samtycke, Art. 6(1)(a), inhämtat separat inför varje skanning). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). XposedOrNot (sökning mot databas för läckta uppgifter vid e-postskanning) — leverantören anger i sin egen policy att sökningar behandlas endast i minnet och inte lagras, men offentliggör inget bolagsnamn eller jurisdiktion, varför vi inhämtar ditt uttryckliga samtycke separat inför varje skanning istället för att behandla dem som ett vanligt personuppgiftsbiträde. Alla övriga biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §. Samtyckesloggar: 7 år (bevis för avtalsslut). Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$function$;
$mig026body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('027', 'critical_security_lockdown', ARRAY[$mig027body$-- CRITICAL pre-go-live security fixes, found by a full audit:
--
-- 1) Paywall bypass: the single "FOR ALL USING (auth.uid()=id)" policy on profiles
--    let any authenticated user UPDATE their own level/subscription_status/
--    stripe_customer_id/stripe_subscription_id directly via the REST API --
--    e.g. PATCH .../profiles?id=eq.<self> {"level":3} granted free Ghost access
--    with zero Stripe payment. Those columns must only ever be written by
--    service-role code (stripe-webhook / stripe-checkout).
--
-- 2) All 19 admin_* SECURITY DEFINER functions were EXECUTE-able by anon and
--    authenticated with no internal admin check, bypassing RLS entirely --
--    anyone with just the public anon key could call them, no login required.
--    The admin-* edge functions already use a service-role client, so revoking
--    public EXECUTE costs nothing functionally.
--
-- 3) profiles also allowed self-DELETE via the same ALL-policy, bypassing the
--    real delete-account flow (and the Stripe-cancellation fix that adds).

-- ── Fix 1: lock down the protected profile columns ─────────────────────────
revoke update (level, subscription_status, stripe_customer_id, stripe_subscription_id)
  on public.profiles from authenticated, anon;

revoke delete on public.profiles from authenticated, anon;

-- Defense in depth: even if a future grant accidentally reopens column access,
-- this trigger reverts those columns unless the actor is service_role.
create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.level := old.level;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_billing_columns on public.profiles;
create trigger protect_profile_billing_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_billing_columns();

-- ── Fix 2: revoke public execute on every admin_* RPC ──────────────────────
do $$
declare
  fn record;
begin
  for fn in
    select routine_name, pg_get_function_identity_arguments(p.oid) as args
    from information_schema.routines r
    join pg_proc p on p.proname = r.routine_name
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where r.routine_schema = 'public' and r.routine_name like 'admin\_%'
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon, authenticated;',
      fn.routine_name, fn.args
    );
  end loop;
end $$;

-- Note: is_admin() is deliberately NOT revoked here -- it's referenced inside
-- RLS policies on audit_logs/admin_deletions/analytics_events (USING (is_admin())),
-- which are evaluated as the querying (authenticated) role. Revoking EXECUTE
-- on it would break the admin account's own access through those policies.
-- It's lower risk anyway per the audit: it only reflects the caller's own JWT.
$mig027body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('028', 'lockdown_analytics_and_audit_logs', ARRAY[$mig028body$-- analytics_events accepted unrestricted, spoofable writes: any unauthenticated
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
$mig028body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('029', 'requests_type_and_unique', ARRAY[$mig029body$-- Part 1 of closing the Cipher/Ghost tier-promise gaps:
--
-- request_type is added so cron jobs (e.g. the upcoming general 30-day
-- follow-up) can filter gdpr_art17 vs opt_out requests without duplicating
-- the company-id list from src/data/companies.ts into every function, the
-- way send-reminders already does today.
--
-- The unique constraint on (user_id, company_id) turns every insert into an
-- upsert target, so revisiting a company's request page and copying/sending
-- again updates the same tracked row instead of cluttering the dashboard
-- with duplicates -- this also fixes a latent duplicate-row possibility in
-- Ghost's existing send flow, which had no such constraint before.
alter table public.requests add column if not exists request_type text;

alter table public.requests
  add constraint requests_user_company_unique unique (user_id, company_id);
$mig029body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('030', 'requests_followup_columns', ARRAY[$mig030body$-- Part 2 of closing the Ghost tier-promise gap (automatic follow-up / reminder
-- on no response) -- the only existing reminder job is hardcoded to 5 opt-out
-- sites' 12-month renewal, unrelated to "did this company respond to my GDPR
-- request". These columns let a new general follow-up job be self-contained
-- (no need to hardcode/duplicate the growing company list from
-- src/data/companies.ts into yet another edge function):
--
-- sent_via distinguishes a Ghost auto-send from a Cipher self-reported "I sent
-- this" -- only Ghost's promise includes BliGlömd following up with the
-- company itself; Cipher only ever gets nudged as the user.
--
-- company_gdpr_email is captured at send time so the follow-up job can email
-- the company directly without re-deriving it from the frontend's static data.
--
-- escalated_at marks a request as already handled by the 30-day job, so it
-- fires exactly once per request rather than every day thereafter.
alter table public.requests add column if not exists sent_via text
  check (sent_via is null or sent_via in ('ghost_auto', 'cipher_manual'));
alter table public.requests add column if not exists company_gdpr_email text;
alter table public.requests add column if not exists escalated_at timestamptz;
$mig030body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('031', 'send_followups_cron', ARRAY[$mig031body$-- ── GENERAL 30-DAY FOLLOW-UP — pg_cron + pg_net schedule ───────────────────
-- Calls send-followups daily at 09:30 UTC (staggered 30 min after the existing
-- send-reminders-daily job). Closes requests.sent_at + 30 days with no
-- response: nudges the user, and for Ghost-sent requests, auto-follows-up
-- with the company itself.
-- FOLLOWUPS_SECRET is read from Supabase Vault at runtime — never stored in git.
-- The secret was stored in Vault with:
--   select vault.create_secret('<uuid>', 'followups-secret', '...');
-- and as an edge function env via:
--   supabase secrets set FOLLOWUPS_SECRET=<uuid>

select cron.schedule(
  'send-followups-daily',
  '30 9 * * *',
  $$
    select net.http_post(
      url     := 'https://ydkahdqvuykpmjkpunck.supabase.co/functions/v1/send-followups',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from   vault.decrypted_secrets
          where  name = 'followups-secret'
          limit  1
        )
      ),
      body    := '{}'::jsonb
    )
  $$
);
$mig031body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('032', 'requests_ghost_auto_lockdown', ARRAY[$mig032body$-- The `requests` table's only RLS policy (001_initial_schema.sql) is FOR ALL USING
-- (auth.uid() = user_id) with no WITH CHECK, which Postgres reuses as the write-side
-- check too -- so it only ever restricted *whose* row gets written, never *which
-- values* land in it. That let any authenticated (even free-tier) caller upsert
-- sent_via='ghost_auto' directly via the REST API, which (a) bypassed the Ghost
-- paywall for the auto-follow-up feature, and (b) let send-followups' company-facing
-- auto-follow-up email (gated only on sent_via='ghost_auto' + company_gdpr_email) be
-- redirected to an attacker-chosen address, since company_gdpr_email rode along in the
-- same forged upsert.
--
-- The Ghost auto-send flow now writes this row itself from the send-request edge
-- function (service-role, after its own independent Ghost-tier check) instead of the
-- client doing a separate direct upsert -- so no legitimate client-side write of
-- sent_via='ghost_auto' should exist any more. This trigger makes that unenforceable
-- by direct-API bypass rather than just no-longer-used by the UI.
create or replace function public.protect_requests_ghost_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.sent_via = 'ghost_auto' then
    new.sent_via := case when TG_OP = 'UPDATE' then old.sent_via else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_requests_ghost_auto_trigger on public.requests;
create trigger protect_requests_ghost_auto_trigger
before insert or update on public.requests
for each row execute function public.protect_requests_ghost_auto();
$mig032body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('033', 'requests_bankid_reminder_column', ARRAY[$mig033body$-- Separates "sent the 11-month renew-soon nudge" from "the 12-month BankID protection
-- actually lapsed" (send-reminders previously conflated these into a single status='expired'
-- write at the 11-month mark, contradicting the reminder email's own "expires in about a
-- month" wording for the following 30 days).
alter table public.requests
  add column if not exists bankid_reminder_sent_at timestamptz;
$mig033body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('034', 'requests_self_reported_bankid', ARRAY[$mig034body$-- Closes the "Ghost BankID renewal reminder" reachability gap: Ratsit, Merinfo,
-- Hitta.se and Birthday.se are BankID-only opt-outs with no gdpr_email at all (email
-- genuinely doesn't work for them, per their own instructions) -- so neither Cipher's
-- "mark as sent" letter-tracking nor Ghost's auto-send panel ever renders for them
-- (both require company.gdpr_email), meaning no 'sent' row could ever exist for the
-- reminder cron to act on. BliGlömd can't do the BankID step for anyone regardless of
-- tier (identity verification can't be delegated), so tracking "I did this myself" is
-- added as its own self-report affordance, open to any tier -- the Ghost-exclusive part
-- stays exclusive at the *reminder email* step (send-reminders now checks the user's
-- current profile.level before emailing), not at the tracking step.
alter table public.requests drop constraint if exists requests_sent_via_check;
alter table public.requests add constraint requests_sent_via_check
  check (sent_via is null or sent_via in ('ghost_auto', 'cipher_manual', 'self_reported'));
$mig034body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('035', 'privacy_v8_consent_retention_reworded', ARRAY[$mig035body$-- Privacy Policy v8: the consent-log retention promise ("7 years, evidence of
-- contractual agreement") contradicted actual behavior -- self-service account
-- deletion CASCADE-deletes consent_records/signup_consent_records immediately,
-- with no archival anywhere in the codebase. Rather than build an archival path
-- that keeps evidence a deleted user no longer wants kept, the policy is
-- reworded to match reality: deleting your account deletes everything,
-- including consent logs, with no exception. Only Stripe-held payment/
-- accounting records remain (7 years, Bokföringslagen), since those live in
-- Stripe's own system, independent of the local BliGlömd account.
-- Text must match src/config/terms.ts exactly -- this is the DB-side snapshot
-- taken at signup for the consent audit trail. Terms (§v4) is unchanged.

create or replace function public.handle_new_user_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-09-25-v4',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-09-25-v4
Gäller fr.o.m. 2026-09-25

1. PARTER
BliGlömd.se är en del av Lykkebo Fastigheter Kommanditbolag, Org.nr 969797-1647. Tjänsten BliGlömd tillhandahålls av Lykkebo Fastigheter Kommanditbolag (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis. Abonnemang kan sägas upp när som helst utan bindningstid. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. ÅTERBETALNING
Betalningar är i regel slutgiltiga och återbetalas inte. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om Kunden är missnöjd med tjänstens resultat eller funktion, förutsatt att tjänsten levererats i enlighet med avsnitt 2.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden i dessa fall.

Undantag — utebliven leverans: Om Tjänsteleverantören på grund av ett tekniskt fel eller annat förhållande som helt beror på Tjänsteleverantören inte har levererat den betalda tjänstens kärnfunktion alls (till exempel att ett betalt abonnemang aldrig aktiverades), har Kunden rätt att inom skälig tid begära återbetalning för den period felet avsåg. Undantaget gäller inte fel som beror på omständigheter utanför Tjänsteleverantörens kontroll (t.ex. tredje parts system) eller när tjänsten i övrigt fungerat enligt avsnitt 2 (bästa ansträngning, inga garanterade resultat).

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-09-29-v8',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-09-29-v8
Gäller fr.o.m. 2026-09-29

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd.se är en del av Lykkebo Fastigheter Kommanditbolag, Org.nr 969797-1647. BliGlömd, som drivs av Lykkebo Fastigheter Kommanditbolag, är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat — se avsnitt 4 om XposedOrNot. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering, köp och skanning. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att söka i XposedOrNots dataintrångsdatabas (uttryckligt samtycke, Art. 6(1)(a), inhämtat separat inför varje skanning). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). XposedOrNot (sökning mot databas för läckta uppgifter vid e-postskanning) — leverantören anger i sin egen policy att sökningar behandlas endast i minnet och inte lagras, men offentliggör inget bolagsnamn eller jurisdiktion, varför vi inhämtar ditt uttryckliga samtycke separat inför varje skanning istället för att behandla dem som ett vanligt personuppgiftsbiträde. Alla övriga biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata — inklusive samtyckesloggar: raderas permanent när du raderar ditt konto. Raderingen är total: samtliga uppgifter tas bort vid det tillfället och kan inte återställas. Betalnings- och bokföringsunderlag som Stripe innehar är ett separat undantag och sparas där i 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §, oavsett om du raderar ditt BliGlömd-konto. Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$function$;
$mig035body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('036', 'subscription_cancellation_visibility', ARRAY[$mig036body$-- Found during go-live verification 2026-09-30: a customer who schedules a
-- cancellation via the Stripe billing portal ("cancel at period end") sees
-- that reflected in Stripe's own portal, but BliGlömd's own Profile page had
-- no idea it existed -- we never stored cancel_at_period_end/current_period_end
-- anywhere, so the app just showed "Ghost, Aktiv" with no hint the plan is
-- ending. Access itself was correctly preserved until period end (level/
-- subscription_status logic already handles that right); this only adds the
-- missing visibility.

alter table public.profiles
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end timestamptz;
$mig036body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('037', 'exclude_admin_from_usage_stats', ARRAY[$mig037body$-- Found live 2026-09-30 during the admin panel walkthrough: only
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
$mig037body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('038', 'retain_consent_records_anonymized', ARRAY[$mig038body$-- Decision reversal (2026-09-30, founder instruction during go-live verification):
-- migration 035 reworded the Privacy Policy to match the fact that consent
-- records were CASCADE-deleted with account deletion, rather than build
-- retention. Founder now wants the opposite: purchase consent (the
-- angerratt-waiver record) and signup consent (Terms/Privacy acceptance)
-- BOTH survive account deletion, anonymized -- closing a real legal gap
-- flagged in an earlier assessment (no way to prove a deleted customer once
-- waived their right of withdrawal or accepted the no-refund terms).
--
-- user_id is set NULL on deletion rather than kept, per explicit choice: the
-- record keeps its evidentiary value (timestamp, version, consent text,
-- price/device info) without staying linked to the person, the stronger
-- GDPR-compatible position under Art. 17(3)(e) (legal-claims exception).
--
-- Applied directly 2026-09-30 (this file records it for history/reproducibility).
-- The Privacy Policy text update + signup-consent trigger snapshot bump that
-- normally accompanies a retention-policy change is tracked separately -- see
-- go-live protocol -- since it touches published legal text.

alter table public.consent_records
  alter column user_id drop not null;
alter table public.consent_records
  drop constraint consent_records_user_id_fkey,
  add constraint consent_records_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

alter table public.signup_consent_records
  alter column user_id drop not null;
alter table public.signup_consent_records
  drop constraint signup_consent_records_user_id_fkey,
  add constraint signup_consent_records_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;
$mig038body$]::text[]) on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements) values ('039', 'privacy_v9_consent_retention_reinstated', ARRAY[$mig039body$-- Privacy Policy v9: reinstate the consent-retention exception that
-- migration 035 removed, now genuinely backed by migration 038's schema
-- change (consent_records/signup_consent_records survive account deletion,
-- anonymized via user_id set to NULL). Founder instruction 2026-09-30.
-- Text must match src/config/terms.ts / src/pages/Privacy.tsx exactly --
-- this is the DB-side snapshot taken at signup for the consent audit trail.
-- Terms (§v4) is unchanged, only Privacy changes.

create or replace function public.handle_new_user_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  consent_text text := new.raw_user_meta_data->>'signup_consent_text';
begin
  if consent_text is null or length(trim(consent_text)) = 0 then
    raise exception 'Consent to Terms of Service and Privacy Policy is required to create an account';
  end if;

  insert into public.signup_consent_records (
    user_id, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text
  ) values (
    new.id,
    '2026-09-25-v4',
    $SNAPSHOT$KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version 2026-09-25-v4
Gäller fr.o.m. 2026-09-25

1. PARTER
BliGlömd.se är en del av Lykkebo Fastigheter Kommanditbolag, Org.nr 969797-1647. Tjänsten BliGlömd tillhandahålls av Lykkebo Fastigheter Kommanditbolag (nedan "Tjänsteleverantören" eller "BliGlömd"). Kontakt: kontakt@bliglömd.se. Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".

2. TJÄNSTENS NATUR — BÄSTA ANSTRÄNGNING (BEST EFFORT)
Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag. Tjänsteleverantören garanterar inte:
a) Kontinuerlig drift, drifttid eller tillgänglighet.
b) Att GDPR-raderingsförfrågningar behandlas, godkänns eller resulterar i radering av data hos tredje part.
c) Att tjänsten uppnår något specifikt resultat för Kunden.
d) Att tjänsten är fri från fel, avbrott eller säkerhetsbrister.
Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.

3. PRISER OCH BETALNING
Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis. Abonnemang kan sägas upp när som helst utan bindningstid. Tjänsteleverantören förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter.

4. ÅNGERRÄTT — UTTRYCKLIGT AVSTÅENDE
Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning. I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad. Kunden lämnar sådant samtycke i samband med köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.

5. ÅTERBETALNING
Betalningar är i regel slutgiltiga och återbetalas inte. Detta gäller uttryckligen:
a) Om Kunden väljer att avsluta sitt abonnemang innan perioden löpt ut.
b) Om Kunden inte utnyttjar tjänsten eller delar av den.
c) Om Kunden är missnöjd med tjänstens resultat eller funktion, förutsatt att tjänsten levererats i enlighet med avsnitt 2.
d) Om Kundens konto stängs till följd av brott mot dessa villkor.
Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden i dessa fall.

Undantag — utebliven leverans: Om Tjänsteleverantören på grund av ett tekniskt fel eller annat förhållande som helt beror på Tjänsteleverantören inte har levererat den betalda tjänstens kärnfunktion alls (till exempel att ett betalt abonnemang aldrig aktiverades), har Kunden rätt att inom skälig tid begära återbetalning för den period felet avsåg. Undantaget gäller inte fel som beror på omständigheter utanför Tjänsteleverantörens kontroll (t.ex. tredje parts system) eller när tjänsten i övrigt fungerat enligt avsnitt 2 (bästa ansträngning, inga garanterade resultat).

6. SERVICEAVBROTT OCH NEDLÄGGNING
Tjänsteleverantören har rätt att när som helst, utan föregående meddelande och utan kompensation:
a) Tillfälligt stänga ner tjänsten för underhåll eller av tekniska skäl.
b) Permanent lägga ned tjänsten, helt eller delvis.
c) Ändra eller ta bort funktioner.
Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid.

7. ANSVARSBEGRÄNSNING
Tjänsteleverantörens totala ansvar gentemot Kunden — oavsett ansvarsgrund — är begränsat till det lägsta av: (a) summan av Kundens betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor. Tjänsteleverantören ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data eller skador som uppstår ur Kundens tillit till tjänstens resultat.

8. ANVÄNDARDATA OCH OPERATIONELL DATA
Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. Tjänsteleverantören behandlar personuppgifter enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn. Tjänsteleverantören äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan anonymiserad data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.

9. IMMATERIELLA RÄTTIGHETER
Alla rättigheter till tjänstens kod, design, varumärke, innehåll och infrastruktur tillhör uteslutande Tjänsteleverantören. Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt.

10. VILLKORSÄNDRINGAR
Tjänsteleverantören kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel. Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.

11. TILLÄMPLIG LAG OCH TVISTLÖSNING
Detta avtal regleras av svensk rätt. Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom 30 dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum. Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.

12. FULLSTÄNDIGT AVTAL
Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.$SNAPSHOT$,
    '2026-09-30-v9',
    $SNAPSHOT2$INTEGRITETSPOLICY — BLIGLÖMD
Version 2026-09-30-v9
Gäller fr.o.m. 2026-09-30

1. VEM ANSVARAR FÖR DINA UPPGIFTER?
BliGlömd.se är en del av Lykkebo Fastigheter Kommanditbolag, Org.nr 969797-1647. BliGlömd, som drivs av Lykkebo Fastigheter Kommanditbolag, är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.

2. VILKA UPPGIFTER BEHANDLAR VI?
Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat — se avsnitt 4 om XposedOrNot. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering, köp och skanning. Besöksstatistik: se avsnitt 7 och 8.

3. VARFÖR BEHANDLAR VI DINA UPPGIFTER?
För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att söka i XposedOrNots dataintrångsdatabas (uttryckligt samtycke, Art. 6(1)(a), inhämtat separat inför varje skanning). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera och vid behov bevara samtycke, inklusive efter kontoradering (rättslig förpliktelse + berättigat intresse att kunna fastställa, göra gällande eller försvara rättsliga anspråk, Art. 6(1)(c) och (f), samt Art. 17(3)(e)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).

4. PERSONUPPGIFTSBITRÄDEN
Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). XposedOrNot (sökning mot databas för läckta uppgifter vid e-postskanning) — leverantören anger i sin egen policy att sökningar behandlas endast i minnet och inte lagras, men offentliggör inget bolagsnamn eller jurisdiktion, varför vi inhämtar ditt uttryckliga samtycke separat inför varje skanning istället för att behandla dem som ett vanligt personuppgiftsbiträde. Alla övriga biträden är bundna av personuppgiftsbiträdesavtal.

5. HUR LÄNGE SPARAR VI DINA UPPGIFTER?
Konto- och tjänstedata raderas permanent när du raderar ditt konto och kan inte återställas. Samtyckesloggar (vid registrering och köp) är ett separat undantag: tidsstämpel, villkors- och policyversion, samtyckestext samt (för köp) pris-id och enhetsuppgifter sparas även efter radering, men kopplingen till din identitet tas bort — ditt användar-id nollställs i posten. Detta stödjer vår möjlighet att visa vad du godkänt, inklusive avståendet från ångerrätten vid köp, med stöd av GDPR Art. 17(3)(e) (fastställande, utövande eller försvar av rättsliga anspråk). Betalnings- och bokföringsunderlag som Stripe innehar är ytterligare ett separat undantag och sparas där i 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §, oavsett om du raderar ditt BliGlömd-konto. Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).

6. DINA RÄTTIGHETER
Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Denna rätt till radering omfattar inte de anonymiserade samtyckesloggar som beskrivs i avsnitt 5. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.

7. KAKOR OCH LOKAL LAGRING
BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se avsnitt 8) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.

8. BESÖKSSTATISTIK
Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff. Om du är inloggad kopplas dessa händelser till ditt konto; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.

9. KONTAKT
För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.$SNAPSHOT2$,
    consent_text
  );

  return new;
end;
$function$;
$mig039body$]::text[]) on conflict (version) do nothing;