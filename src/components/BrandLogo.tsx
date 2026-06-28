import { useId } from 'react'

interface BrandLogoProps {
  variant?: 'large' | 'compact' | 'symbol'
  className?: string
}

function ShieldNav({ gradId }: { gradId: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 4L6 9.5V20c0 7.5 5.8 14.5 14 16.5 8.2-2 14-9 14-16.5V9.5L20 4z"
        fill={`url(#${gradId})`}
      />
      <circle cx="20" cy="19" r="6" fill="rgba(255,255,255,0.25)" />
      <path d="M20 14a3 3 0 100 6 3 3 0 000-6z" fill="white" />
      <path
        d="M14.5 28c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"
      />
      <path
        d="M17.5 23l1.5 1.5 3-3"
        stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <defs>
        <linearGradient id={gradId} x1="20" y1="4" x2="20" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function ShieldHero({ gradId }: { gradId: string }) {
  return (
    <svg width="100" height="110" viewBox="0 0 100 110" fill="none" aria-hidden="true">
      {/* Decorative arcs */}
      <path d="M18 30 Q8 55 18 80" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M14 35 Q6 55 14 75" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
      <path d="M82 30 Q92 55 82 80" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M86 35 Q94 55 86 75" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
      {/* Shield body */}
      <path
        d="M50 8L22 18V44c0 18 12 34 28 40 16-6 28-22 28-40V18L50 8z"
        fill={`url(#${gradId})`}
      />
      {/* Person silhouette */}
      <circle cx="50" cy="42" r="8" fill="white" />
      <path d="M34 66c0-8.8 7.2-14 16-14s16 5.2 16 14" fill="white" />
      {/* Checkmark badge */}
      <circle cx="66" cy="60" r="10" fill="#22C55E" />
      <path
        d="M61 60l3 3 6-6"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <defs>
        <linearGradient id={gradId} x1="50" y1="8" x2="50" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function BrandLogo({ variant = 'compact', className = '' }: BrandLogoProps) {
  const uid = useId().replace(/:/g, '_')
  const gradId = `bliglomd-sg-${uid}`

  if (variant === 'symbol') {
    return (
      <div className={className} style={{ display: 'inline-flex' }}>
        <ShieldNav gradId={gradId} />
      </div>
    )
  }

  if (variant === 'large') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="animate-float-shield" style={{ display: 'inline-block', marginBottom: 28 }}>
          <ShieldHero gradId={gradId} />
        </div>
        <div
          style={{
            fontSize: 'clamp(44px, 6vw, 72px)',
            fontWeight: 400,
            color: '#1E3A8A',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          Bli<span style={{ fontWeight: 800 }}>Glömd</span>
        </div>
        <p
          style={{
            fontSize: 16,
            color: '#64748B',
            lineHeight: 1.6,
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          Din rätt att försvinna från internet.<br />Vi ser till att det händer.
        </p>
      </div>
    )
  }

  // compact — navbar
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ShieldNav gradId={gradId} />
      <div>
        <div style={{ fontSize: 16, fontWeight: 400, color: '#1E3A8A', lineHeight: 1.1 }}>
          Bli<strong style={{ fontWeight: 700 }}>Glömd</strong>
        </div>
        <div
          style={{
            fontSize: 8,
            fontWeight: 500,
            letterSpacing: '0.06em',
            color: '#3B82F6',
            lineHeight: 1.3,
            textTransform: 'uppercase',
          }}
        >
          DIN RÄTT ATT FÖRSVINNA · VI SER TILL ATT DET HÄNDER.
        </div>
      </div>
    </div>
  )
}
