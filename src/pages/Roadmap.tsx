import { useLang } from '../contexts/LanguageContext'

export function Roadmap() {
  const { t } = useLang()
  const { badge, title, subtitle, items } = t.roadmapPage

  return (
    <div className="px-4 sm:px-6 pt-8 sm:pt-10 md:pt-12 pb-14 sm:pb-20" style={{ background: '#F5F7FF', minHeight: '100vh' }}>
      <div style={{ maxWidth: 740, margin: '0 auto', width: '100%' }}>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7A99', textTransform: 'uppercase', marginBottom: 8 }}>
            {badge}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1B2640', letterSpacing: '-0.025em', marginBottom: 8, lineHeight: 1.2 }}>
            {title}
          </h1>
          <p style={{ fontSize: 14, color: '#6B7A99', lineHeight: 1.6 }}>
            {subtitle}
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

        <div style={{ marginTop: 48, borderTop: '1px solid #E2E8F0', paddingTop: 24, fontSize: 12, color: '#64748B', lineHeight: 1.7 }}>
          <p>© 2026 BliGlömd · kontakt@bliglömd.se</p>
        </div>

      </div>
    </div>
  )
}
