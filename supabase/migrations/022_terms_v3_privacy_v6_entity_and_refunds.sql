-- Terms bumped to v3, Privacy bumped to v6:
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
