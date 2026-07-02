import { useLang } from '../contexts/LanguageContext'
import { PRIVACY_VERSION } from '../config/terms'

export function Privacy() {
  const { lang } = useLang()
  const isEn = lang === 'en'

  return (
    <div style={{ background: '#F5F7FF', minHeight: '100vh', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7A99', textTransform: 'uppercase', marginBottom: 8 }}>
            {isEn ? 'Privacy Policy' : 'Integritetspolicy'}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1B2640', letterSpacing: '-0.025em', marginBottom: 8, lineHeight: 1.2 }}>
            BliGlömd
          </h1>
          <p style={{ fontSize: 14, color: '#6B7A99', lineHeight: 1.6 }}>
            {isEn
              ? `Version ${PRIVACY_VERSION}. Effective from 1 July 2026.`
              : `Version ${PRIVACY_VERSION}. Gäller fr.o.m. 1 juli 2026.`
            }
          </p>
        </div>

        {[
          {
            title: isEn ? '1. Who is responsible for your data?' : '1. Vem ansvarar för dina uppgifter?',
            body: isEn
              ? 'BliGlömd (Thorsten Grund, sole trader) is the data controller. Contact for data protection questions: kontakt@bliglömd.se.'
              : 'BliGlömd (Thorsten Grund, enskild firma) är personuppgiftsansvarig. Kontakt för dataskyddsfrågor: kontakt@bliglömd.se.',
          },
          {
            title: isEn ? '2. What data do we process?' : '2. Vilka uppgifter behandlar vi?',
            body: isEn
              ? 'Account data: email address, full name. Service data: GDPR deletion requests sent (company, status, timestamp). Scan data: email addresses you scan, breach results. Payment data: handled entirely by Stripe — BliGlömd never sees card numbers. Consent records: timestamp and text of your agreement to our terms at signup and purchase. Traffic statistics: see section 7.'
              : 'Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid registrering och köp. Besöksstatistik: se avsnitt 7.',
          },
          {
            title: isEn ? '3. Why do we process your data?' : '3. Varför behandlar vi dina uppgifter?',
            body: isEn
              ? 'To provide the service (legal basis: contract performance, GDPR Art. 6(1)(b)). To send GDPR deletion requests on your behalf (contract performance). To maintain accounting records as required by Swedish law (legal obligation, Art. 6(1)(c)). To record consent (legal obligation + legitimate interest, Art. 6(1)(c) and (f)). To understand how the service is used and identify which companies are missing from our directory (legitimate interest, Art. 6(1)(f)).'
              : 'För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera samtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)). För att förstå hur tjänsten används och identifiera vilka företag som saknas i vår katalog (berättigat intresse, Art. 6(1)(f)).',
          },
          {
            title: isEn ? '4. Data processors (sub-processors)' : '4. Personuppgiftsbiträden',
            body: isEn
              ? 'Supabase Inc. (database and authentication, servers in Frankfurt, EU). Stripe Inc. (payment processing, EU data handling). Brevo SAS (transactional email, headquartered and hosted in France, EU). All processors are bound by data processing agreements.'
              : 'Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Brevo SAS (transaktionell e-post, huvudkontor och datahantering i Frankrike, EU). Alla biträden är bundna av personuppgiftsbiträdesavtal.',
          },
          {
            title: isEn ? '5. How long do we keep your data?' : '5. Hur länge sparar vi dina uppgifter?',
            body: isEn
              ? 'Account and service data: deleted when you delete your account. Payment/accounting records: 7 years, counted from the end of the calendar year in which the financial year concluded, as required by the Swedish Bookkeeping Act (1999:1078) Ch. 7 §2. Consent records: 7 years (evidence of contractual agreement). Traffic statistics: 90 days. Anonymised usage data: indefinitely (not personal data).'
              : 'Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år, räknat från utgången av det kalenderår då räkenskapsåret avslutades, enligt Bokföringslagen (1999:1078) 7 kap. 2 §. Samtyckesloggar: 7 år (bevis för avtalsslut). Besöksstatistik: 90 dagar. Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).',
          },
          {
            title: isEn ? '6. Your rights' : '6. Dina rättigheter',
            body: isEn
              ? 'You have the right to access, correct or delete your personal data; to data portability; to object to processing; and to lodge a complaint with the Swedish Authority for Privacy Protection (IMY), imy.se. To exercise your rights, contact kontakt@bliglömd.se.'
              : 'Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.',
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

        <div style={{ marginTop: 48, borderTop: '1px solid #E2E8F0', paddingTop: 24, fontSize: 12, color: '#94A3B8', lineHeight: 1.7 }}>
          <p>© 2026 BliGlömd · kontakt@bliglömd.se</p>
        </div>

      </div>
    </div>
  )
}
