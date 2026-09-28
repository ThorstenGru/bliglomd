import { useLang } from '../contexts/LanguageContext'

interface RoadmapItem {
  title: string
  body: string
  tag: string
}

const SV_ITEMS: RoadmapItem[] = [
  {
    title: 'Löpande dataintrångsbevakning',
    body: 'Vi bevakar din e-post kontinuerligt och meddelar dig direkt om den dyker upp i ett nytt dataintrång — inte bara vid en engångsskanning.',
    tag: 'Cipher & Ghost',
  },
  {
    title: 'Automatisk förnyelse av spärrar',
    body: 'Vi håller koll på när dina 12-månadersspärrar (Ratsit, Merinfo m.fl.) börjar löpa ut och guidar dig genom förnyelsen i god tid, med allt förifyllt.',
    tag: 'Ghost',
  },
  {
    title: 'Eskalering vid uteblivet svar',
    body: 'Svarar inte ett företag inom 30 dagar skickar vi automatiskt en skarpare påminnelse — och för Ghost, ett färdigt klagomål till Integritetsskyddsmyndigheten (IMY).',
    tag: 'Cipher & Ghost',
  },
  {
    title: 'Årlig integritetsrapport',
    body: 'En gång om året sammanställer vi vad som hänt sedan sist: företag du rensat, intrång vi hittat, och spärrar som snart löper ut.',
    tag: 'Cipher & Ghost',
  },
  {
    title: 'Familjeskydd',
    body: 'Skydda hela familjen under ett och samma abonnemang — en lösning för dig som redan sköter det här åt fler än dig själv.',
    tag: 'Ny nivå',
  },
  {
    title: 'Dödsbo-tjänst',
    body: 'Hjälp med att avsluta en avliden anhörigs digitala konton och abonnemang, som dödsbodelägare.',
    tag: 'Engångsköp',
  },
  {
    title: 'Företagspaket',
    body: 'BliGlömd som medarbetarförmån, eller som en del av en strukturerad offboarding-process när någon slutar.',
    tag: 'Företag',
  },
]

const EN_ITEMS: RoadmapItem[] = [
  {
    title: 'Continuous breach monitoring',
    body: 'We keep watching your email and alert you the moment it shows up in a new data breach — not just at a one-time scan.',
    tag: 'Cipher & Ghost',
  },
  {
    title: 'Automatic opt-out renewal',
    body: "We track when your 12-month opt-outs (Ratsit, Merinfo, etc.) are about to expire and guide you through renewing in good time, pre-filled.",
    tag: 'Ghost',
  },
  {
    title: 'Escalation on no response',
    body: "If a company doesn't respond within 30 days, we automatically send a firmer follow-up — and for Ghost, a ready-made complaint to the Swedish Data Protection Authority (IMY).",
    tag: 'Cipher & Ghost',
  },
  {
    title: 'Annual privacy report',
    body: "Once a year, we sum up what happened: companies cleared, breaches found, and opt-outs coming up for renewal.",
    tag: 'Cipher & Ghost',
  },
  {
    title: 'Family protection',
    body: 'Protect your whole household under one subscription — for when you already handle this for more than just yourself.',
    tag: 'New tier',
  },
  {
    title: 'Digital estate service',
    body: 'Help closing a deceased relative\'s digital accounts and subscriptions, as an estate administrator.',
    tag: 'One-time purchase',
  },
  {
    title: 'Employer packages',
    body: 'BliGlömd as an employee benefit, or as part of a structured offboarding process when someone leaves.',
    tag: 'Business',
  },
]

export function Roadmap() {
  const { lang } = useLang()
  const isEn = lang === 'en'
  const items = isEn ? EN_ITEMS : SV_ITEMS

  return (
    <div className="px-4 sm:px-6 pt-8 sm:pt-10 md:pt-12 pb-14 sm:pb-20" style={{ background: '#F5F7FF', minHeight: '100vh' }}>
      <div style={{ maxWidth: 740, margin: '0 auto', width: '100%' }}>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7A99', textTransform: 'uppercase', marginBottom: 8 }}>
            {isEn ? 'Coming soon' : 'Kommer snart'}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1B2640', letterSpacing: '-0.025em', marginBottom: 8, lineHeight: 1.2 }}>
            {isEn ? "What's next for BliGlömd" : 'Det här bygger vi härnäst'}
          </h1>
          <p style={{ fontSize: 14, color: '#6B7A99', lineHeight: 1.6 }}>
            {isEn
              ? "A look at what we're planning — not yet available, and dates aren't fixed."
              : 'En titt på vad vi planerar — inget av detta är tillgängligt än, och inga datum är satta.'
            }
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {items.map((item) => (
            <div
              key={item.title}
              style={{ borderTop: '1px solid #E2E8F0', padding: '24px 0' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B2640', letterSpacing: '-0.01em', margin: 0 }}>
                  {item.title}
                </h2>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2852D9', background: '#EAEFFE', padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {item.tag}
                </span>
              </div>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, margin: 0 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, borderTop: '1px solid #E2E8F0', paddingTop: 24, fontSize: 12, color: '#94A3B8', lineHeight: 1.7 }}>
          <p>© 2026 BliGlömd · kontakt@bliglömd.se</p>
        </div>

      </div>
    </div>
  )
}
