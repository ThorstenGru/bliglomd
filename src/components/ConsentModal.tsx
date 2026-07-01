import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { TERMS_VERSION, TERMS_FULL_TEXT, CONSENT_CHECKBOX_TEXT } from '../config/terms'
import { trackFunnel } from '../lib/analytics'

interface ConsentModalProps {
  priceId: string
  planLabel: string
  onConfirmed: () => void
  onClose: () => void
}

export function ConsentModal({ priceId, planLabel, onConfirmed, onClose }: ConsentModalProps) {
  const { lang } = useLang()
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleConfirm() {
    if (!checked) return
    setSaving(true)
    setErr(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('consent_records').insert({
        user_id:        user.id,
        terms_version:  TERMS_VERSION,
        terms_snapshot: TERMS_FULL_TEXT,
        consent_text:   CONSENT_CHECKBOX_TEXT,
        price_id:       priceId,
        user_agent:     navigator.userAgent,
        consent_context: 'checkout',
      })
      if (error) throw error
      trackFunnel('checkout_started', { price_id: priceId })
      onConfirmed()
    } catch (e) {
      setErr(lang === 'sv' ? 'Kunde inte spara samtycke. Försök igen.' : 'Could not save consent. Please try again.')
      setSaving(false)
    }
  }

  const isEn = lang === 'en'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'white', borderRadius: 16, padding: '32px 28px',
        maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#6B7A99', textTransform: 'uppercase', marginBottom: 6 }}>
            {isEn ? 'Before you pay' : 'Innan du betalar'}
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1B2640', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {isEn ? `Purchase ${planLabel}` : `Köp ${planLabel}`}
          </h2>
        </div>

        {/* Key terms summary */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {isEn ? 'Key terms you are agreeing to' : 'Villkor du godkänner'}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(isEn ? [
              'Service is provided "best effort" — no guaranteed outcomes.',
              'No refunds under any circumstances once payment is made.',
              'Right of withdrawal is waived upon immediate digital delivery.',
              'If the service shuts down, no refund or compensation is owed.',
              'Liability is capped at the lower of 3 months\' fees or SEK 500.',
              'Disputes resolved in Helsingborg, Swedish law governs.',
            ] : [
              'Tjänsten levereras som "bästa ansträngning" — inga garanterade utfall.',
              'Inga återbetalningar ges efter genomförd betalning.',
              'Ångerrätten upphör vid omedelbar aktivering av digital tjänst.',
              'Vid nedläggning av tjänsten ges ingen återbetalning eller ersättning.',
              'Ansvar begränsat till lägst 3 månaders avgifter eller 500 kr.',
              'Tvister avgörs i Helsingborgs tingsrätt under svensk lag.',
            ]).map((point) => (
              <li key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                <span style={{ color: '#DC2626', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                {point}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: '#6B7A99', marginTop: 12 }}>
            {isEn
              ? <>Full terms: <Link to="/terms" target="_blank" style={{ color: '#2852D9' }}>bliglömd.se/terms</Link> (version {TERMS_VERSION})</>
              : <>Fullständiga villkor: <Link to="/terms" target="_blank" style={{ color: '#2852D9' }}>bliglömd.se/terms</Link> (version {TERMS_VERSION})</>
            }
          </p>
        </div>

        {/* Consent checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: '#2852D9', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: '#1B2640', lineHeight: 1.55 }}>
            {isEn
              ? 'I have read and accept the Purchase Agreement. I explicitly consent to immediate activation of the digital service — my right of withdrawal is hereby waived. I understand that no refunds are given and that the service is provided without guarantees.'
              : CONSENT_CHECKBOX_TEXT
            }
          </span>
        </label>

        {err && (
          <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{err}</p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #E2E8F0', background: 'white', color: '#6B7A99', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            {isEn ? 'Cancel' : 'Avbryt'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!checked || saving}
            style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: checked ? '#2852D9' : '#E2E8F0',
              color: checked ? 'white' : '#94A3B8',
              fontSize: 14, fontWeight: 600, cursor: checked ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {saving
              ? (isEn ? 'Saving…' : 'Sparar…')
              : (isEn ? 'I agree — proceed to payment' : 'Jag godkänner — till betalning')}
          </button>
        </div>

        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 14, textAlign: 'center', lineHeight: 1.5 }}>
          {isEn
            ? 'Your agreement is recorded with a timestamp in our database (version ' + TERMS_VERSION + ').'
            : 'Ditt godkännande sparas med tidsstämpel i vår databas (version ' + TERMS_VERSION + ').'}
        </p>
      </div>
    </div>
  )
}
