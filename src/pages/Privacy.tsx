import { useLang } from '../contexts/LanguageContext'
import { PRIVACY_VERSION } from '../config/terms'

export function Privacy() {
  const { lang } = useLang()
  const isEn = lang === 'en'

  return (
    <div className="px-4 sm:px-6 pt-8 sm:pt-10 md:pt-12 pb-14 sm:pb-20" style={{ background: '#F5F7FF', minHeight: '100vh' }}>
      <div style={{ maxWidth: 740, margin: '0 auto', width: '100%' }}>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7A99', textTransform: 'uppercase', marginBottom: 8 }}>
            {isEn ? 'Privacy Policy' : 'Integritetspolicy'}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1B2640', letterSpacing: '-0.025em', marginBottom: 8, lineHeight: 1.2 }}>
            BliGlömd
          </h1>
          <p style={{ fontSize: 14, color: '#6B7A99', lineHeight: 1.6 }}>
            {isEn
              ? `Version ${PRIVACY_VERSION}. The Swedish version is the legally binding version.`
              : `Version ${PRIVACY_VERSION}. Den svenska versionen är juridiskt bindande.`
            }
          </p>
        </div>

        {[
          {
            title: isEn ? '1. Who is responsible for your data?' : '1. Vem ansvarar för dina uppgifter?',
            body: isEn
              ? 'BliGlömd.se is part of Lykkebo Fastigheter Kommanditbolag, Swedish company registration no. 969797-1647. BliGlömd, operated by Lykkebo Fastigheter Kommanditbolag, is the data controller. Contact for data protection questions: kontakt@bliglömd.se.'
              : 'BliGlömd.se är en del av Lykkebo Fastigheter Kommanditbolag, Org.nr 969797-1647. BliGlömd, som drivs av Lykkebo Fastigheter Kommanditbolag, är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.',
          },
          {
            title: isEn ? '2. What data do we process?' : '2. Vilka uppgifter behandlar vi?',
            body: isEn
              ? 'Account data: email address, full name. Service data: GDPR deletion requests sent (company, status, timestamp). Scan data: email addresses you scan, breach results — see section 4 regarding XposedOrNot. Payment data: handled entirely by Stripe — BliGlömd never sees card numbers. Consent records: timestamp and text of your agreement to our terms at signup, purchase, and scanning. Traffic statistics: see section 7.'
              : 'Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat — se avsnitt 4 om XposedOrNot. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering, köp och skanning. Besöksstatistik: se avsnitt 7.',
          },
          {
            title: isEn ? '3. Why do we process your data?' : '3. Varför behandlar vi dina uppgifter?',
            body: isEn
              ? 'To provide the service (legal basis: contract performance, GDPR Art. 6(1)(b)). To send GDPR deletion requests on your behalf (contract performance). To search XposedOrNot\'s breach database (explicit consent, Art. 6(1)(a), obtained separately before each scan). To maintain accounting records as required by Swedish law (legal obligation, Art. 6(1)(c)). To record and, where needed, retain consent — including after account deletion (legal obligation + legitimate interest in being able to establish, exercise or defend legal claims, Art. 6(1)(c) and (f), and Art. 17(3)(e)). To understand how the service is used and identify which companies are missing from our directory (legitimate interest, Art. 6(1)(f)).'
              : 'För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att söka i XposedOrNots dataintrångsdatabas (uttryckligt samtycke, Art. 6(1)(a), inhämtat separat inför varje skanning). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera och vid behov bevara samtycke, inklusive efter kontoradering (rättslig förpliktelse + berättigat intresse att kunna fastställa, göra gällande eller försvara rättsliga anspråk, Art. 6(1)(c) och (f), samt Art. 17(3)(e)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).',
          },
          {
            title: isEn ? '4. Data processors (sub-processors)' : '4. Personuppgiftsbiträden',
            body: isEn
              ? 'Supabase Inc. (database and authentication, servers in Frankfurt, EU). Stripe Inc. (payment processing, EU data handling). Brevo SAS (transactional email, headquartered and hosted in France, EU). XposedOrNot (breach-database lookup during email scans) — its own policy states queries are processed in memory only and not stored, but it discloses no company name or jurisdiction, so we obtain your explicit consent separately before each scan rather than treating it as a standard processor. All other processors are bound by data processing agreements.'
              : 'Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). XposedOrNot (sökning mot databas för läckta uppgifter vid e-postskanning) — leverantören anger i sin egen policy att sökningar behandlas endast i minnet och inte lagras, men offentliggör inget bolagsnamn eller jurisdiktion, varför vi inhämtar ditt uttryckliga samtycke separat inför varje skanning istället för att behandla dem som ett vanligt personuppgiftsbiträde. Alla övriga biträden är bundna av personuppgiftsbiträdesavtal.',
          },
          {
            title: isEn ? '5. How long do we keep your data?' : '5. Hur länge sparar vi dina uppgifter?',
            body: isEn
              ? 'Account and service data are permanently deleted when you delete your account, and cannot be recovered. Consent records (at signup and at purchase) are a separate exception: the timestamp, terms/policy version, consent text, and (for purchases) the price ID and device details are retained even after deletion, but the link to your identity is removed — your user ID is set to null on the record. This supports our ability to demonstrate what you agreed to, including the waiver of your right of withdrawal at purchase, under GDPR Art. 17(3)(e) (establishment, exercise or defence of legal claims). Payment/accounting records held by Stripe are a further separate exception, kept for 7 years, counted from the end of the calendar year the financial year ended, as required by the Swedish Bookkeeping Act (1999:1078) Ch. 7 §2, regardless of your BliGlömd account deletion. Traffic statistics: 90 days. Anonymised usage data: indefinitely (not personal data).'
              : 'Konto- och tjänstedata raderas permanent när du raderar ditt konto och kan inte återställas. Samtyckesloggar (vid registrering och köp) är ett separat undantag: tidsstämpel, villkors- och policyversion, samtyckestext samt (för köp) pris-id och enhetsuppgifter sparas även efter radering, men kopplingen till din identitet tas bort — ditt användar-id nollställs i posten. Detta stödjer vår möjlighet att visa vad du godkänt, inklusive avståendet från ångerrätten vid köp, med stöd av GDPR Art. 17(3)(e) (fastställande, utövande eller försvar av rättsliga anspråk). Betalnings- och bokföringsunderlag som Stripe innehar är ytterligare ett separat undantag och sparas där i 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §, oavsett om du raderar ditt BliGlömd-konto. Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).',
          },
          {
            title: isEn ? '6. Your rights' : '6. Dina rättigheter',
            body: isEn
              ? 'You have the right to access, correct or delete your personal data; to data portability; to object to processing; and to lodge a complaint with the Swedish Authority for Privacy Protection (IMY), imy.se. This right of erasure does not extend to the anonymised consent records described in section 5. To exercise your rights, contact kontakt@bliglömd.se.'
              : 'Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Denna rätt till radering omfattar inte de anonymiserade samtyckesloggar som beskrivs i avsnitt 5. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.',
          },
          {
            title: isEn ? '7. Cookies and local storage' : '7. Kakor och lokal lagring',
            body: isEn
              ? 'BliGlömd uses strictly necessary local storage (localStorage) set by Supabase for authentication, and a session cookie for login itself. This storage is required for the service to function and does not require consent under the Swedish Electronic Communications Act, since it is necessary to provide the service you have explicitly requested. No advertising or cross-site tracking is used. Traffic statistics (see below) use a random, temporary identifier stored only in your browser\'s session storage — it is cleared when you close the tab and cannot be used to identify you across visits or websites.'
              : 'BliGlömd använder strikt nödvändig lokal lagring (localStorage) som sätts av Supabase för autentisering, samt en session-cookie för själva inloggningen. Denna lagring krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK), eftersom den är nödvändig för att tillhandahålla den tjänst du uttryckligen begärt. Ingen reklam eller spårning över flera webbplatser används. Besöksstatistik (se nedan) använder en slumpmässig, tillfällig identifierare som endast sparas i din webbläsares sessionsminne — den försvinner när du stänger fliken och kan inte användas för att identifiera dig mellan besök eller webbplatser.',
          },
          {
            title: isEn ? '8. Traffic statistics' : '8. Besöksstatistik',
            body: isEn
              ? 'We collect first-party, cookie-free traffic statistics directly on our own servers — no third-party analytics service is used, and no data leaves BliGlömd\'s systems. This includes: which pages are visited, the referring website (only for the first page of a visit), your language choice, and searches in our company directory that returned no results (so we know which companies to add). If you are logged in, these events are linked to your account so you can request their deletion along with the rest of your data; if you are not logged in, they are only linked to the temporary session identifier described in section 7. This data is not sold, shared with advertisers, or used to build a cross-site profile of you.'
              : 'Vi samlar in förstapartsstatistik utan kakor direkt på våra egna servrar — ingen extern analystjänst används, och ingen data lämnar BliGlömds system. Detta omfattar: vilka sidor som besöks, hänvisande webbplats (endast för besökets första sida), ditt språkval, samt sökningar i vår företagskatalog som inte gav träff (så att vi vet vilka företag vi bör lägga till). Om du är inloggad kopplas dessa händelser till ditt konto så att du kan begära radering av dem tillsammans med resten av din data; är du inte inloggad kopplas de enbart till den tillfälliga sessionsidentifierare som beskrivs i avsnitt 7. Denna data säljs inte, delas inte med annonsörer och används inte för att bygga en profil av dig över flera webbplatser.',
          },
          {
            title: isEn ? '9. Contact' : '9. Kontakt',
            body: isEn
              ? 'For data protection queries: kontakt@bliglömd.se. We aim to respond within 30 days.'
              : 'För dataskyddsfrågor: kontakt@bliglömd.se. Vi strävar efter att svara inom 30 dagar.',
          },
        ].map((section) => (
          <div key={section.title} style={{ borderTop: '1px solid #E2E8F0', padding: '24px 0' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B2640', marginBottom: 10, letterSpacing: '-0.01em' }}>
              {section.title}
            </h2>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65 }}>
              {section.body}
            </p>
          </div>
        ))}

        <div style={{ marginTop: 48, borderTop: '1px solid #E2E8F0', paddingTop: 24, fontSize: 12, color: '#64748B', lineHeight: 1.7 }}>
          <p>© 2026 BliGlömd · kontakt@bliglömd.se</p>
        </div>

      </div>
    </div>
  )
}
