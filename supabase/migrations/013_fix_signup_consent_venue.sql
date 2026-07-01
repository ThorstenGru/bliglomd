-- Fix: exclusive forum changed from Stockholms tingsrätt to Helsingborgs tingsrätt.
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
