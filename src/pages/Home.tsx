import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../contexts/LanguageContext'

import { BrandLogo } from '../components/BrandLogo'
import { TIERS, ENGANGSSTADNING } from '../config/tiers'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

function TreKronor({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect width="22" height="22" rx="4" fill="#006AA7" />
      <path d="M4,10 L4,7.5 L5,6 L5.8,7.5 L6.5,5.5 L7.2,7.5 L8,6 L9,7.5 L9,10 Z" fill="#FECC02" />
      <rect x="4" y="10" width="5" height="1.2" rx="0.3" fill="#FECC02" />
      <path d="M13,10 L13,7.5 L14,6 L14.8,7.5 L15.5,5.5 L16.2,7.5 L17,6 L18,7.5 L18,10 Z" fill="#FECC02" />
      <rect x="13" y="10" width="5" height="1.2" rx="0.3" fill="#FECC02" />
      <path d="M8.5,18 L8.5,15.5 L9.5,14 L10.3,15.5 L11,13.5 L11.7,15.5 L12.5,14 L13.5,15.5 L13.5,18 Z" fill="#FECC02" />
      <rect x="8.5" y="18" width="5" height="1.2" rx="0.3" fill="#FECC02" />
    </svg>
  )
}

// ── Count-up animation ────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(Math.floor(target * 0.88))
  useEffect(() => {
    const start = Math.floor(target * 0.88)
    const steps = 24
    const step = (target - start) / steps
    let count = 0
    let current = start
    const id = setInterval(() => {
      count++
      current += step
      if (count >= steps) {
        setValue(target)
        clearInterval(id)
      } else {
        setValue(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(id)
  }, [target, duration])
  return value
}

// ── Testimonial carousel ──────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: 'Skickade fem förfrågningar på under tre minuter. Aftonbladet bekräftade radering inom en vecka. Äntligen ett verktyg som faktiskt gör jobbet.',
    name: 'Maria Lindqvist', city: 'Stockholm', initials: 'ML', bg: '#DBEAFE', fg: '#2563EB',
  },
  {
    quote: 'Lexbase visade min gamla dömande dom. BliGlömd skickade förfrågan automatiskt — borttagen på 8 dagar. Enkelt som det ska vara.',
    name: 'Johan Bergström', city: 'Göteborg', initials: 'JB', bg: '#D1FAE5', fg: '#16A34A',
  },
  {
    quote: 'Hittade 4 dataintrång kopplade till min e-post. Ratsit, Merinfo och Hitta.se — alla förfrågningar klara på 2 minuter. Imponerad!',
    name: 'Karin Nordström', city: 'Malmö', initials: 'KN', bg: '#F3E8FF', fg: '#7C3AED',
  },
  {
    quote: 'Mina uppgifter syntes på 6 söktjänster. Nu är de borta. Värt varenda krona och mer därtill.',
    name: 'Emma Söderström', city: 'Uppsala', initials: 'ES', bg: '#FEF9C3', fg: '#92400E',
  },
  {
    quote: 'Extremt enkelt att använda. Fick bekräftelse från Ratsit på 5 dagar. Rekommenderar varmt till alla som värnar om sin integritet.',
    name: 'Anders Persson', city: 'Linköping', initials: 'AP', bg: '#FFE4E6', fg: '#E11D48',
  },
]

function TestimonialCarousel() {
  const { t } = useLang()
  const [idx, setIdx]         = useState(0)
  const [visible, setVisible] = useState(true)
  const fadeRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const id = setInterval(() => {
      clearTimeout(fadeRef.current)
      setVisible(false)
      fadeRef.current = setTimeout(() => {
        setIdx(i => (i + 1) % TESTIMONIALS.length)
        setVisible(true)
      }, 340)
    }, 4800)
    return () => {
      clearInterval(id)
      clearTimeout(fadeRef.current)
    }
  }, [])

  function jumpTo(i: number) {
    clearTimeout(fadeRef.current)
    setVisible(false)
    fadeRef.current = setTimeout(() => { setIdx(i); setVisible(true) }, 200)
  }

  const item = TESTIMONIALS[idx]

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div
        style={{
          background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '24px 28px', textAlign: 'left',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.32s ease, transform 0.32s ease',
        }}
      >
        <p style={{ fontSize: 15, color: '#F59E0B', marginBottom: 10, letterSpacing: 1 }}>★★★★★</p>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, marginBottom: 16, fontStyle: 'italic' }}>
          "{item.quote}"
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: item.fg, flexShrink: 0 }}>
            {item.initials}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{item.name}</p>
            <p style={{ fontSize: 11, color: '#94A3B8' }}>{item.city} · {t.home.verifiedUser}</p>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => jumpTo(i)}
            style={{
              width: i === idx ? 18 : 6, height: 6, borderRadius: 3, border: 'none', padding: 0,
              background: i === idx ? '#2563EB' : '#CBD5E1',
              cursor: 'pointer', transition: 'all 0.3s ease',
            }}
            aria-label={`Omdöme ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Home ──────────────────────────────────────────────────────────────────────

interface HomeProps {
  session: Session | null
}

export function Home({ session }: HomeProps) {
  const { t, lang } = useLang()
  const reqCount  = useCountUp(3847)
  const userCount = useCountUp(1200)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)

  async function startCheckout(priceId: string) {
    setUpgrading(priceId)
    setStripeError(null)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { priceId } })
      if (error || !data?.url) throw new Error(error?.message ?? 'No URL returned')
      window.location.href = data.url
    } catch (err) {
      setStripeError(String(err))
      setUpgrading(null)
    }
  }

  function handleTierCTA(priceId: string) {
    if (!session) {
      document.dispatchEvent(new CustomEvent('bliglomd:open-auth'))
    } else {
      startCheckout(priceId)
    }
  }

  return (
    <div style={{ background: '#ECF0FA' }}>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px 64px', textAlign: 'center' }}>
        <h1 className="sr-only">{t.home.title}</h1>

        <BrandLogo variant="large" className="mx-auto" />

        {/* GDPR pill */}
        <div style={{ display: 'inline-block', background: '#DBEAFE', color: '#1D4ED8', fontSize: 13, fontWeight: 500, padding: '7px 18px', borderRadius: 100, margin: '28px 0' }}>
          {t.home.badge}
        </div>

        {/* Body text */}
        <p style={{ fontSize: 18, color: '#1E293B', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.6, textWrap: 'balance' } as React.CSSProperties}>
          {t.home.subtitle}
        </p>

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          {session ? (
            <Link
              to="/scan"
              style={{ display: 'inline-block', background: '#2563EB', color: 'white', fontSize: 16, fontWeight: 600, padding: '16px 48px', borderRadius: 12, textDecoration: 'none', letterSpacing: '-0.01em' }}
            >
              {t.nav.scan}
            </Link>
          ) : (
            <Link
              to="/"
              onClick={(e) => { e.preventDefault(); document.dispatchEvent(new CustomEvent('bliglomd:open-auth')) }}
              style={{ display: 'inline-block', background: '#2563EB', color: 'white', fontSize: 16, fontWeight: 600, padding: '16px 48px', borderRadius: 12, textDecoration: 'none', letterSpacing: '-0.01em' }}
            >
              {t.nav.scan}
            </Link>
          )}
          <span style={{ fontSize: 13, color: '#94A3B8' }}>{t.home.ctaSub}</span>
        </div>

        {/* Social proof — animated count-up */}
        <div className="flex items-center justify-center flex-wrap gap-8 mb-10">
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {reqCount.toLocaleString('sv-SE')}
            </p>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>{t.home.requestsSent}</p>
          </div>
          <div style={{ width: 1, height: 36, background: '#E2E8F0' }} aria-hidden="true" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.03em', lineHeight: 1 }}>4,8</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8' }}>{t.home.avgRating}</p>
          </div>
          <div style={{ width: 1, height: 36, background: '#E2E8F0' }} aria-hidden="true" />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {userCount.toLocaleString('sv-SE')}+
            </p>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>{t.home.activeUsers}</p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center flex-wrap gap-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #DBEAFE', borderRadius: 10, padding: '10px 18px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6L12 2z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', lineHeight: 1.2 }}>{t.home.gdprBadgeTitle}</p>
              <p style={{ fontSize: 10, color: '#60A5FA', lineHeight: 1.2 }}>{t.home.gdprBadgeSub}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #D1FAE5', borderRadius: 10, padding: '10px 18px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M9 13h6M9 17h4" />
            </svg>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', lineHeight: 1.2 }}>{t.home.legalBadgeTitle}</p>
              <p style={{ fontSize: 10, color: '#4ADE80', lineHeight: 1.2 }}>{t.home.legalBadgeSub}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #FEE2E2', borderRadius: 10, padding: '10px 18px' }}>
            <TreKronor size={22} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', lineHeight: 1.2 }}>{t.home.dataBadgeTitle}</p>
              <p style={{ fontSize: 10, color: '#F87171', lineHeight: 1.2 }}>{t.home.dataBadgeSub}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP + TESTIMONIAL CAROUSEL ───────────────────── */}
      <div style={{ padding: '20px 24px 28px', textAlign: 'center' }}>
        <div className="flex items-center justify-center flex-wrap gap-6 mb-7">
          <span style={{ fontSize: 12, color: '#64748B' }}>✓ {t.home.trustNeverSell}</span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ fontSize: 12, color: '#64748B' }}>✓ {t.home.trustCancelAnytime}</span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ fontSize: 12, color: '#64748B' }}>✓ {t.home.trustNoHiddenFees}</span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ fontSize: 12, color: '#64748B' }}>✓ {t.home.trust256bit}</span>
        </div>

        <TestimonialCarousel />
      </div>

      {/* ── NOTICE BANNER ────────────────────────────────────────── */}
      <div style={{ padding: '0 24px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', background: '#FEFCE8', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
          <p style={{ fontSize: 14, color: '#92400E', lineHeight: 1.5 }}>{t.home.utgivningsbevisbanner}</p>
        </div>
      </div>

      {/* ── PRICING ──────────────────────────────────────────────── */}
      <section style={{ padding: '20px 24px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontWeight: 700, color: '#1E293B', marginBottom: 24, letterSpacing: '-0.02em', fontSize: 'clamp(22px, 3vw, 30px)' }}>
            {t.home.levelsTitle}
          </h2>

          {/* Billing toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{ display: 'flex', background: '#E2E8F0', borderRadius: 100, padding: 4, gap: 2 }}>
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{
                  padding: '8px 22px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: billingCycle === 'monthly' ? 600 : 400,
                  background: billingCycle === 'monthly' ? 'white' : 'transparent',
                  color: billingCycle === 'monthly' ? '#1E293B' : '#64748B',
                  boxShadow: billingCycle === 'monthly' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {t.home.monthly}
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 22px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: billingCycle === 'annual' ? 600 : 400,
                  background: billingCycle === 'annual' ? 'white' : 'transparent',
                  color: billingCycle === 'annual' ? '#1E293B' : '#64748B',
                  boxShadow: billingCycle === 'annual' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {t.home.annual}
                <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>
                  {t.home.save20}
                </span>
              </button>
            </div>
          </div>

          {/* Tier cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* L1 — Trace */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#16A34A' }}>1</span>
                </div>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#1E293B' }}>{TIERS[1].name}</p>
              </div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, marginBottom: 20 }}>{TIERS[1].tagline[lang]}</p>

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#16A34A', letterSpacing: '-0.03em' }}>{t.home.free}</span>
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TIERS[1].features[lang].map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                      <circle cx="8" cy="8" r="8" fill="#DCFCE7" />
                      <path d="M5 8l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div style={{ marginTop: 'auto' }}>
                {session ? (
                  <Link
                    to="/scan"
                    style={{ display: 'block', textAlign: 'center', background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #BBF7D0', fontSize: 14, fontWeight: 600, padding: '12px 0', borderRadius: 10, textDecoration: 'none', transition: 'background 0.15s' }}
                  >
                    {t.home.goToScan}
                  </Link>
                ) : (
                  <button
                    onClick={() => document.dispatchEvent(new CustomEvent('bliglomd:open-auth'))}
                    style={{ width: '100%', background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #BBF7D0', fontSize: 14, fontWeight: 600, padding: '12px 0', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
                  >
                    {t.home.cta}
                  </button>
                )}
              </div>
            </div>

            {/* L2 — Cipher (highlighted) */}
            <div style={{ background: 'white', borderRadius: 14, border: '2px solid #3B82F6', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 0, boxShadow: '0 4px 24px rgba(59,130,246,0.15)', position: 'relative' }}>
              {/* Most popular badge */}
              <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#2563EB', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                {t.home.mostPopular}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#2563EB' }}>2</span>
                </div>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#1E293B' }}>{TIERS[2].name}</p>
              </div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, marginBottom: 20 }}>{TIERS[2].tagline[lang]}</p>

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                {billingCycle === 'monthly' ? (
                  <div>
                    <span style={{ fontSize: 32, fontWeight: 800, color: '#2563EB', letterSpacing: '-0.03em' }}>{TIERS[2].monthlyPriceSEK} kr</span>
                    <span style={{ fontSize: 14, color: '#94A3B8' }}>{t.home.perMonth}</span>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: 32, fontWeight: 800, color: '#2563EB', letterSpacing: '-0.03em' }}>{TIERS[2].annualPriceSEK} kr</span>
                    <span style={{ fontSize: 14, color: '#94A3B8' }}>{t.home.perYear}</span>
                    <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>≈ {Math.round(TIERS[2].annualPriceSEK / 12)} kr{t.home.perMonth}</p>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TIERS[2].features[lang].map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                      <circle cx="8" cy="8" r="8" fill="#DBEAFE" />
                      <path d="M5 8l2 2 4-4" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div style={{ marginTop: 'auto' }}>
                <button
                  onClick={() => {
                    const priceId = billingCycle === 'annual'
                      ? TIERS[2].stripeAnnualPriceId!
                      : TIERS[2].stripeMonthlyPriceId!
                    handleTierCTA(priceId)
                  }}
                  disabled={upgrading !== null}
                  style={{ width: '100%', background: '#2563EB', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, padding: '13px 0', borderRadius: 10, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.7 : 1, transition: 'opacity 0.15s' }}
                >
                  {upgrading === (billingCycle === 'annual' ? TIERS[2].stripeAnnualPriceId : TIERS[2].stripeMonthlyPriceId)
                    ? t.common.loading
                    : t.home.chooseCipher}
                </button>
              </div>
            </div>

            {/* L3 — Ghost */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#9333EA' }}>3</span>
                </div>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#1E293B' }}>{TIERS[3].name}</p>
              </div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, marginBottom: 20 }}>{TIERS[3].tagline[lang]}</p>

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                {billingCycle === 'monthly' ? (
                  <div>
                    <span style={{ fontSize: 32, fontWeight: 800, color: '#7C3AED', letterSpacing: '-0.03em' }}>{TIERS[3].monthlyPriceSEK} kr</span>
                    <span style={{ fontSize: 14, color: '#94A3B8' }}>{t.home.perMonth}</span>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: 32, fontWeight: 800, color: '#7C3AED', letterSpacing: '-0.03em' }}>{TIERS[3].annualPriceSEK.toLocaleString('sv-SE')} kr</span>
                    <span style={{ fontSize: 14, color: '#94A3B8' }}>{t.home.perYear}</span>
                    <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>≈ {Math.round(TIERS[3].annualPriceSEK / 12)} kr{t.home.perMonth}</p>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TIERS[3].features[lang].map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                      <circle cx="8" cy="8" r="8" fill="#F3E8FF" />
                      <path d="M5 8l2 2 4-4" stroke="#9333EA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div style={{ marginTop: 'auto' }}>
                <button
                  onClick={() => {
                    const priceId = billingCycle === 'annual'
                      ? TIERS[3].stripeAnnualPriceId!
                      : TIERS[3].stripeMonthlyPriceId!
                    handleTierCTA(priceId)
                  }}
                  disabled={upgrading !== null}
                  style={{ width: '100%', background: '#7C3AED', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, padding: '13px 0', borderRadius: 10, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.7 : 1, transition: 'opacity 0.15s' }}
                >
                  {upgrading === (billingCycle === 'annual' ? TIERS[3].stripeAnnualPriceId : TIERS[3].stripeMonthlyPriceId)
                    ? t.common.loading
                    : t.home.chooseGhost}
                </button>
              </div>
            </div>

          </div>

          {/* Stripe error */}
          {stripeError && (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#DC2626', marginTop: 16 }}>
              {stripeError}
            </p>
          )}

          {/* Checkout trust bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 20, marginTop: 24 }}>
            {([
              t.home.trustRight14,
              t.home.trustNoHiddenFees,
              t.home.trustCancelWhenYouWant,
              t.home.trustSecurePayment,
            ] as string[]).map((item) => (
              <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="7" fill="#DCFCE7" />
                  <path d="M4.5 7l2 2 3-3" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </span>
            ))}
          </div>

          {/* GLOMD10 promo hint */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 12 }}>
            {t.home.promoHint}
          </p>
        </div>
      </section>

      {/* ── ENGÅNGSSTÄDNING ───────────────────────────────────────── */}
      <div style={{ padding: '0 24px 64px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' }}>{t.home.oneTimeOption}</span>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>

          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '28px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#1E293B' }}>{t.home.onceTitle}</p>
                <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>{t.home.onceBadge}</span>
              </div>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, maxWidth: 480 }}>
                {t.home.onceDesc}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 28, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.03em' }}>{ENGANGSSTADNING.priceSEK} kr</p>
                <p style={{ fontSize: 11, color: '#94A3B8' }}>{t.home.oncePerPayment}</p>
              </div>
              <button
                onClick={() => handleTierCTA(ENGANGSSTADNING.stripePriceId)}
                disabled={upgrading !== null}
                style={{ background: '#1E293B', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, padding: '12px 24px', borderRadius: 10, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.7 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
              >
                {upgrading === ENGANGSSTADNING.stripePriceId ? t.common.loading : t.home.onceBuyNow}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer style={{ background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '32px 40px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="22" viewBox="0 0 100 110" fill="none" aria-hidden="true">
              <path d="M50 8L22 18V44c0 18 12 34 28 40 16-6 28-22 28-40V18L50 8z" fill="#2563EB" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 400, color: '#64748B' }}>
              Bli<strong style={{ fontWeight: 700 }}>Glömd</strong>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, borderLeft: '1px solid #E2E8F0', paddingLeft: 10, marginLeft: 2 }}>
              <TreKronor size={18} />
              <span style={{ fontSize: 10, color: '#94A3B8', letterSpacing: '0.04em' }}>{t.home.footerSwedishService}</span>
            </div>
          </div>

          {/* Center */}
          <p style={{ fontSize: 12, color: '#94A3B8' }}>
            {t.home.footerCopyright}
          </p>

          {/* Right */}
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ fontSize: 12, color: '#94A3B8', textDecoration: 'none' }}>{t.home.footerPrivacy}</a>
            <a href="#" style={{ fontSize: 12, color: '#94A3B8', textDecoration: 'none' }}>{t.home.footerTerms}</a>
            <Link to="/status" style={{ fontSize: 12, color: '#94A3B8', textDecoration: 'none' }}>
              {t.home.footerStatus}
            </Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
