import { useLang } from '../contexts/LanguageContext'
import { TERMS_VERSION } from '../config/terms'

interface Section {
  num: string
  title: string
  body: string[]
}

const SV_SECTIONS: Section[] = [
  {
    num: '1', title: 'Parter',
    body: [
      'Tjänsten BliGlömd tillhandahålls av Thorsten Grund, enskild firma (nedan "BliGlömd" eller "Tjänsteleverantören"). Kontakt: kontakt@bliglömd.se.',
      'Den fysiska eller juridiska person som ingår detta avtal benämns "Kunden".',
    ],
  },
  {
    num: '2', title: 'Tjänstens natur — bästa ansträngning (best effort)',
    body: [
      'Tjänsten levereras "i befintligt skick" och "i mån av tillgänglighet" utan garantier av något slag.',
      'BliGlömd garanterar inte: (a) kontinuerlig drift, drifttid eller tillgänglighet, (b) att GDPR-raderingsförfrågningar behandlas eller godkänns av tredje part, (c) att personuppgifter faktiskt raderas hos mottagande bolag, (d) att tjänsten är fri från fel, avbrott eller säkerhetsbrister, (e) att tjänsten uppnår något specifikt resultat.',
      'Samtliga funktioner erbjuds utan utfästelse och kan ändras, begränsas eller tas bort utan förvarning.',
    ],
  },
  {
    num: '3', title: 'Priser och betalning',
    body: [
      'Priser anges i SEK. Betalning sker via Stripe i förskott, månadsvis eller årsvis beroende på valt abonnemang.',
      'BliGlömd förbehåller sig rätten att justera priser med minst 14 dagars avisering till befintliga prenumeranter. Fortsatt användning efter prisjustering utgör godkännande av nytt pris.',
    ],
  },
  {
    num: '4', title: 'Ångerrätt — uttryckligt avstående',
    body: [
      'Tjänsten är en digital tjänst som aktiveras och levereras omedelbart vid genomförd betalning.',
      'I enlighet med Distansavtalslagen (2005:59) 2 kap. 11 § upphör ångerrätten när Kunden uttryckligen samtycker till omedelbar leverans och bekräftar att ångerrätten därigenom går förlorad.',
      'Kunden lämnar sådant samtycke i samband med varje köp. Ingen ångerrätt gäller efter att tjänsten aktiverats.',
    ],
  },
  {
    num: '5', title: 'Ingen återbetalning',
    body: [
      'Samtliga betalningar är slutgiltiga och återbetalas inte, oavsett omständighet.',
      'Detta gäller uttryckligen: (a) om Kunden väljer att avsluta abonnemanget innan perioden löpt ut, (b) om Kunden inte utnyttjar tjänsten eller delar av den, (c) om tjänsten är otillgänglig, förändras, begränsas eller läggs ned av BliGlömd, (d) om Kundens konto stängs till följd av brott mot dessa villkor, (e) om Kunden är missnöjd med tjänstens resultat.',
      'Kunden har inte rätt till proraterat återbetalning för outnyttjad del av abonnemangsperioden.',
    ],
  },
  {
    num: '6', title: 'Serviceavbrott och nedläggning',
    body: [
      'BliGlömd har rätt att när som helst, utan föregående meddelande och utan kompensation, tillfälligt stänga ner tjänsten för underhåll, permanent lägga ned tjänsten, samt ändra eller ta bort funktioner.',
      'Vid permanent nedläggning ges skälig avisering om möjligt, dock utan krav på återbetalning av innestående abonnemangstid eller annan kompensation.',
    ],
  },
  {
    num: '7', title: 'Ansvarsbegränsning',
    body: [
      'BliGlömds totala ansvar gentemot Kunden — oavsett ansvarsgrund (avtalsbrott, skadestånd, produktansvar eller annat) — är begränsat till det lägsta av: (a) summan av Kundens faktiska betalningar under de senaste tre (3) månaderna, eller (b) femhundra (500) kronor.',
      'BliGlömd ansvarar inte för indirekta skador, följdskador, utebliven vinst, förlorade data, skador till följd av Kundens tillit till tjänstens resultat, eller skador orsakade av tredje parts agerande eller underlåtenhet.',
    ],
  },
  {
    num: '8', title: 'Användardata och operationell data',
    body: [
      'Kunden behåller sina personuppgiftsrättsliga rättigheter enligt GDPR. BliGlömd behandlar personuppgifter som Kunden anger enbart för att tillhandahålla tjänsten, i enlighet med integritetspolicyn.',
      'BliGlömd äger och förbehåller sig rätten att fritt använda anonymiserad och aggregerad användningsstatistik samt operationell metadata (loggar, tidsstämplar, systemhändelser, förfrågningsutfall) för drift, förbättring och analys av tjänsten. Sådan data är inte hänförbar till enskild Kund och omfattas inte av rätten till radering.',
    ],
  },
  {
    num: '9', title: 'Immateriella rättigheter',
    body: [
      'Alla rättigheter till tjänstens kod, design, varumärke, innehåll, databaser och infrastruktur tillhör uteslutande BliGlömd.',
      'Kunden erhåller en begränsad, icke-exklusiv, icke-överlåtbar licens att använda tjänsten under den tid abonnemanget är aktivt. Licensen upphör omedelbart vid avtalets upphörande.',
    ],
  },
  {
    num: '10', title: 'Villkorsändringar',
    body: [
      'BliGlömd kan ändra dessa villkor ensidigt. Väsentliga ändringar aviseras med minst 14 dagars varsel via e-post till Kundens registrerade adress.',
      'Fortsatt användning av tjänsten efter en ändring innebär att Kunden accepterar de uppdaterade villkoren.',
    ],
  },
  {
    num: '11', title: 'Tillämplig lag och tvistlösning',
    body: [
      'Detta avtal regleras av svensk rätt.',
      'Eventuella tvister ska i första hand lösas genom direkta förhandlingar. Om förhandling inte löser tvisten inom trettio (30) dagar ska den avgöras slutgiltigt av Helsingborgs tingsrätt som exklusivt forum.',
      'Förlorande part är skyldig att ersätta vinnande parts skäliga rättegångskostnader.',
    ],
  },
  {
    num: '12', title: 'Fullständigt avtal',
    body: [
      'Dessa villkor, tillsammans med integritetspolicyn, utgör det fullständiga avtalet mellan parterna och ersätter alla tidigare överenskommelser avseende tjänsten.',
      'Avtalsslutet registreras digitalt vid genomförd betalning med tidsstämpel och versionsangivelse (aktuell version: ' + TERMS_VERSION + ').',
    ],
  },
]

const EN_SECTIONS: Section[] = [
  {
    num: '1', title: 'Parties',
    body: [
      'The service BliGlömd is provided by Thorsten Grund, sole trader (hereinafter "BliGlömd" or "Service Provider"). Contact: kontakt@bliglömd.se.',
      'The natural or legal person entering into this agreement is referred to as the "Customer".',
    ],
  },
  {
    num: '2', title: 'Nature of service — best effort',
    body: [
      'The service is provided "as is" and "as available" without warranties of any kind.',
      'BliGlömd does not guarantee: (a) continuous operation, uptime or availability, (b) that GDPR deletion requests are processed or accepted by third parties, (c) that personal data is actually deleted by the receiving company, (d) that the service is free from errors, interruptions or security vulnerabilities, (e) that the service achieves any specific outcome.',
      'All features are offered without commitment and may be changed, restricted or removed without notice.',
    ],
  },
  {
    num: '3', title: 'Prices and payment',
    body: [
      'Prices are stated in SEK. Payment is made via Stripe in advance, monthly or annually depending on the chosen plan.',
      'BliGlömd reserves the right to adjust prices with at least 14 days\' notice to existing subscribers. Continued use after a price change constitutes acceptance of the new price.',
    ],
  },
  {
    num: '4', title: 'Right of withdrawal — explicit waiver',
    body: [
      'The service is a digital service that is activated and delivered immediately upon completed payment.',
      'In accordance with the Swedish Distance Contracts Act (2005:59) Ch. 2 § 11, the right of withdrawal ceases when the Customer explicitly consents to immediate delivery and acknowledges that the right of withdrawal is thereby lost.',
      'The Customer provides such consent in connection with each purchase. No right of withdrawal applies after the service has been activated.',
    ],
  },
  {
    num: '5', title: 'No refunds',
    body: [
      'All payments are final and non-refundable under any circumstances.',
      'This applies explicitly to: (a) the Customer choosing to cancel the subscription before the period expires, (b) the Customer not using the service or parts of it, (c) the service being unavailable, changed, restricted or discontinued by BliGlömd, (d) the Customer\'s account being closed due to breach of these terms, (e) the Customer being dissatisfied with the service\'s results.',
      'The Customer is not entitled to a prorated refund for the unused portion of a subscription period.',
    ],
  },
  {
    num: '6', title: 'Service interruptions and discontinuation',
    body: [
      'BliGlömd has the right at any time, without prior notice and without compensation, to temporarily shut down the service for maintenance, permanently discontinue the service, and change or remove features.',
      'In the event of permanent discontinuation, reasonable notice will be given where possible, but without any obligation to refund remaining subscription time or provide other compensation.',
    ],
  },
  {
    num: '7', title: 'Limitation of liability',
    body: [
      'BliGlömd\'s total liability to the Customer — regardless of legal basis (breach of contract, tort, product liability or otherwise) — is limited to the lesser of: (a) the total of the Customer\'s actual payments during the last three (3) months, or (b) five hundred (500) Swedish kronor.',
      'BliGlömd is not liable for indirect damages, consequential damages, lost profits, lost data, damages arising from the Customer\'s reliance on the service\'s results, or damages caused by third-party actions or omissions.',
    ],
  },
  {
    num: '8', title: 'User data and operational data',
    body: [
      'The Customer retains their personal data rights under GDPR. BliGlömd processes personal data provided by the Customer solely to provide the service, in accordance with the privacy policy.',
      'BliGlömd owns and reserves the right to freely use anonymised and aggregated usage statistics and operational metadata (logs, timestamps, system events, request outcomes) for operation, improvement and analysis of the service. Such data is not attributable to an individual Customer and is not subject to the right of erasure.',
    ],
  },
  {
    num: '9', title: 'Intellectual property',
    body: [
      'All rights to the service\'s code, design, trademarks, content, databases and infrastructure belong exclusively to BliGlömd.',
      'The Customer receives a limited, non-exclusive, non-transferable licence to use the service during the active subscription period. The licence terminates immediately upon termination of the agreement.',
    ],
  },
  {
    num: '10', title: 'Changes to terms',
    body: [
      'BliGlömd may change these terms unilaterally. Material changes will be notified with at least 14 days\' notice via email to the Customer\'s registered address.',
      'Continued use of the service after a change constitutes the Customer\'s acceptance of the updated terms.',
    ],
  },
  {
    num: '11', title: 'Governing law and dispute resolution',
    body: [
      'This agreement is governed by Swedish law.',
      'Any disputes shall first be resolved through direct negotiations. If negotiations do not resolve the dispute within thirty (30) days, it shall be finally determined by Helsingborg District Court as the exclusive forum.',
      'The losing party shall pay the winning party\'s reasonable legal costs.',
    ],
  },
  {
    num: '12', title: 'Entire agreement',
    body: [
      'These terms, together with the privacy policy, constitute the entire agreement between the parties and supersede all prior understandings regarding the service.',
      'Contract formation is recorded digitally upon completed payment with a timestamp and version reference (current version: ' + TERMS_VERSION + ').',
    ],
  },
]

export function Terms() {
  const { lang } = useLang()
  const isEn = lang === 'en'
  const sections = isEn ? EN_SECTIONS : SV_SECTIONS

  return (
    <div style={{ background: '#F5F7FF', minHeight: '100vh', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7A99', textTransform: 'uppercase', marginBottom: 8 }}>
            {isEn ? 'Purchase Agreement' : 'Köpavtal / Allmänna villkor'}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1B2640', letterSpacing: '-0.025em', marginBottom: 8, lineHeight: 1.2 }}>
            BliGlömd
          </h1>
          <p style={{ fontSize: 14, color: '#6B7A99', lineHeight: 1.6 }}>
            {isEn
              ? `Version ${TERMS_VERSION}. Effective from 30 June 2026. The Swedish version is the legally binding version.`
              : `Version ${TERMS_VERSION}. Gäller fr.o.m. 30 juni 2026. Den svenska versionen är juridiskt bindande.`
            }
          </p>
        </div>

        {/* Warning box */}
        <div style={{ background: '#FEF9E8', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 18px', marginBottom: 36, fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
          <strong>{isEn ? 'Important: ' : 'Viktigt: '}</strong>
          {isEn
            ? 'This service is provided without guarantees. No refunds are given. The right of withdrawal is waived upon purchase. Read all sections carefully before paying.'
            : 'Denna tjänst levereras utan garantier. Inga återbetalningar ges. Ångerrätten upphör vid köp. Läs alla avsnitt noga innan du betalar.'
          }
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {sections.map((s) => (
            <div
              key={s.num}
              style={{ borderTop: '1px solid #E2E8F0', padding: '24px 0' }}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2852D9', minWidth: 24, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {s.num}.
                </span>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B2640', marginBottom: 10, letterSpacing: '-0.01em' }}>
                    {s.title}
                  </h2>
                  {s.body.map((para, i) => (
                    <p key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, marginBottom: i < s.body.length - 1 ? 8 : 0 }}>
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 48, borderTop: '1px solid #E2E8F0', paddingTop: 24, fontSize: 12, color: '#94A3B8', lineHeight: 1.7 }}>
          <p>
            {isEn
              ? `© 2026 BliGlömd. Contact: kontakt@bliglömd.se. Terms version: ${TERMS_VERSION}.`
              : `© 2026 BliGlömd. Kontakt: kontakt@bliglömd.se. Villkorsversion: ${TERMS_VERSION}.`
            }
          </p>
        </div>

      </div>
    </div>
  )
}
