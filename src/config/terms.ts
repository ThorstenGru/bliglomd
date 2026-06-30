// Increment TERMS_VERSION whenever the T&C text changes.
// Old consent records retain their snapshot, so audit trail stays intact.
export const TERMS_VERSION = '2026-06-30-v1'

export const TERMS_FULL_TEXT = `KÖPAVTAL / ALLMÄNNA VILLKOR — BLIGLÖMD
Version ${TERMS_VERSION}
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

Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel, versionsangivelse och bekräftelsetext.`

export const CONSENT_CHECKBOX_TEXT =
  'Jag har läst och accepterar Köpavtalet. Jag samtycker uttryckligen till omedelbar aktivering av digital tjänst — min ångerrätt upphör härmed. Jag förstår att inga återbetalningar ges och att tjänsten levereras utan garantier.'
