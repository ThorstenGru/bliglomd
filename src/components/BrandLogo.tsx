import type { CSSProperties } from 'react'

interface BrandLogoProps {
  variant?: 'large' | 'compact' | 'symbol'
  className?: string
}

function ShieldSvg({ style }: { style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ height: '100%', width: 'auto', ...style }}
    >
      {/* Hands/arms wrapping the shield */}
      <path d="M17,25 C4,45 4,72 18,90" stroke="#93C5FD" strokeWidth="5" strokeLinecap="round"/>
      <path d="M83,25 C96,45 96,72 82,90" stroke="#93C5FD" strokeWidth="5" strokeLinecap="round"/>

      {/* Pink data lines — left */}
      <line x1="8" y1="43" x2="14" y2="43" stroke="#FDA4B8" strokeWidth="2" strokeLinecap="round"/>
      <line x1="6" y1="55" x2="13" y2="54" stroke="#FDA4B8" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="7" y1="67" x2="13" y2="66" stroke="#FDA4B8" strokeWidth="1.5" strokeLinecap="round"/>

      {/* Pink data lines — right */}
      <line x1="92" y1="43" x2="86" y2="43" stroke="#FDA4B8" strokeWidth="2" strokeLinecap="round"/>
      <line x1="94" y1="55" x2="87" y2="54" stroke="#FDA4B8" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="93" y1="67" x2="87" y2="66" stroke="#FDA4B8" strokeWidth="1.5" strokeLinecap="round"/>

      {/* Outer shield layer — surface (#E8F0FE) */}
      <path d="M50,8 L87,20 L87,60 Q87,90 50,106 Q13,90 13,60 L13,20 Z" fill="#E8F0FE"/>

      {/* Middle shield layer — primary (#3B82F6) */}
      <path d="M50,16 L80,27 L80,60 Q80,84 50,99 Q20,84 20,60 L20,27 Z" fill="#3B82F6"/>

      {/* Inner shield layer — deep navy (#1E3A8A) */}
      <path d="M50,24 L73,34 L73,60 Q73,78 50,91 Q27,78 27,60 L27,34 Z" fill="#1E3A8A"/>

      {/* Person — head */}
      <circle cx="50" cy="51" r="7" fill="white"/>

      {/* Person — body (shoulders arc) */}
      <path d="M37,69 Q37,59 50,59 Q63,59 63,69" fill="white"/>

      {/* Checkmark — confirmed protection */}
      <path
        d="M41,76 L46,82 L60,70"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandLogo({ variant = 'compact', className = '' }: BrandLogoProps) {
  if (variant === 'symbol') {
    return (
      <div className={className} style={{ display: 'inline-flex' }}>
        <ShieldSvg />
      </div>
    )
  }

  if (variant === 'large') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div style={{ height: 150 }}>
          <ShieldSvg />
        </div>
        <div className="mt-3 text-center" style={{ color: '#1E3A8A', fontSize: 46, lineHeight: 1.1 }}>
          <span style={{ fontWeight: 300 }}>Bli</span>
          <span style={{ fontWeight: 900 }}>Glömd</span>
        </div>
        <p
          className="mt-2 text-center"
          style={{ fontSize: 13.5, color: '#64748b', letterSpacing: '0.4px', lineHeight: 1.5, maxWidth: 340 }}
        >
          Din rätt att försvinna från internet.<br />Vi ser till att det händer.
        </p>
      </div>
    )
  }

  // compact — navbar/card format
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div style={{ height: 28, flexShrink: 0 }}>
        <ShieldSvg />
      </div>
      <div>
        <div style={{ color: '#1E3A8A', fontSize: 15, lineHeight: 1.1 }}>
          <span style={{ fontWeight: 300 }}>Bli</span>
          <span style={{ fontWeight: 900 }}>Glömd</span>
        </div>
        <div style={{ fontSize: 7, color: '#3B82F6', letterSpacing: '0.8px', lineHeight: 1.3 }}>
          <div>DIN RÄTT ATT FÖRSVINNA</div>
          <div>VI SER TILL ATT DET HÄNDER.</div>
        </div>
      </div>
    </div>
  )
}
