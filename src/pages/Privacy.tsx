import { useLang } from '../contexts/LanguageContext'

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
            {isEn ? 'Effective from 30 June 2026.' : 'Gäller fr.o.m. 30 juni 2026.'}
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
              ? 'Account data: email address, full name. Service data: GDPR deletion requests sent (company, status, timestamp). Scan data: email addresses you scan, breach results. Payment data: handled entirely by Stripe — BliGlömd never sees card numbers. Consent records: timestamp and text of your agreement to our terms at purchase.'
              : 'Kontodata: e-postadress, fullständigt namn. Tjänstedata: GDPR-raderingsförfrågningar (bolag, status, tidsstämpel). Skanningsdata: e-postadresser du skannar och intrångresultat. Betalningsdata: hanteras helt av Stripe — BliGlömd ser aldrig kortnummer. Samtyckeslogg: tidsstämpel och text för ditt avtalsaccepterande vid köp.',
          },
          {
            title: isEn ? '3. Why do we process your data?' : '3. Varför behandlar vi dina uppgifter?',
            body: isEn
              ? 'To provide the service (legal basis: contract performance, GDPR Art. 6(1)(b)). To send GDPR deletion requests on your behalf (contract performance). To maintain accounting records as required by Swedish law (legal obligation, Art. 6(1)(c)). To record purchase consent (legal obligation + legitimate interest, Art. 6(1)(c) and (f)).'
              : 'För att tillhandahålla tjänsten (rättslig grund: avtalsprestanda, GDPR Art. 6(1)(b)). För att skicka GDPR-raderingsförfrågningar å dina vägnar (avtalsprestanda). För att föra räkenskaper enligt Bokföringslagen (rättslig förpliktelse, Art. 6(1)(c)). För att registrera köpsamtycke (rättslig förpliktelse + berättigat intresse, Art. 6(1)(c) och (f)).',
          },
          {
            title: isEn ? '4. Data processors (sub-processors)' : '4. Personuppgiftsbiträden',
            body: isEn
              ? 'Supabase Inc. (database and authentication, servers in Frankfurt, EU). Stripe Inc. (payment processing, EU data handling). Resend Inc. (transactional email, EU data handling). All processors are bound by data processing agreements.'
              : 'Supabase Inc. (databas och autentisering, servrar i Frankfurt, EU). Stripe Inc. (betalningshantering, EU-datahantering). Resend Inc. (transaktionell e-post, EU-datahantering). Alla biträden är bundna av personuppgiftsbiträdesavtal.',
          },
          {
            title: isEn ? '5. How long do we keep your data?' : '5. Hur länge sparar vi dina uppgifter?',
            body: isEn
              ? 'Account and service data: deleted when you delete your account. Payment/accounting records: 7 years as required by the Swedish Bookkeeping Act. Consent records: 7 years (evidence of contractual agreement). Anonymised usage data: indefinitely (not personal data).'
              : 'Konto- och tjänstedata: raderas när du raderar ditt konto. Betalnings- och bokföringsunderlag: 7 år enligt Bokföringslagen. Samtyckesloggar: 7 år (bevis för avtalsslut). Anonymiserad användningsdata: på obestämd tid (inte personuppgifter).',
          },
          {
            title: isEn ? '6. Your rights' : '6. Dina rättigheter',
            body: isEn
              ? 'You have the right to access, correct or delete your personal data; to data portability; to object to processing; and to lodge a complaint with the Swedish Authority for Privacy Protection (IMY), imy.se. To exercise your rights, contact kontakt@bliglömd.se.'
              : 'Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter; dataportabilitet; att invända mot behandling; och att lämna klagomål till IMY (Integritetsskyddsmyndigheten), imy.se. Kontakta kontakt@bliglömd.se för att utöva dina rättigheter.',
          },
          {
            title: isEn ? '7. Cookies' : '7. Kakor (cookies)',
            body: isEn
              ? 'BliGlömd uses strictly necessary session cookies set by Supabase for authentication. These cookies are required for the service to function and do not require consent under the Swedish Electronic Communications Act. No advertising or tracking cookies are set.'
              : 'BliGlömd använder strikt nödvändiga sessionscookies som sätts av Supabase för autentisering. Dessa cookies krävs för att tjänsten ska fungera och kräver inte samtycke enligt Lagen om elektronisk kommunikation (LEK). Inga reklam- eller spårningscookies används.',
          },
          {
            title: isEn ? '8. Contact' : '8. Kontakt',
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
