export type Lang = 'sv' | 'en'

export interface Tier {
  /** Stable internal key — never changes, safe to log/store */
  key: 'trace' | 'cipher' | 'ghost'
  /** DB integer — the ONLY thing the backend knows */
  level: 1 | 2 | 3
  /** Brand name — change freely without touching backend */
  name: string
  /** Short badge label shown in pricing cards */
  tag: Record<Lang, string>
  /** One-liner hook shown below the name */
  tagline: Record<Lang, string>
  /** Card description on the home/pricing page */
  description: Record<Lang, string>
  /** Feature bullet list for home/pricing page */
  features: Record<Lang, string[]>
  /** Hint shown in dashboard timeline when a request hasn't been sent yet */
  timelineHint: Record<Lang, string>
  /** Tailwind color ramp used by LevelBadge */
  color: 'green' | 'blue' | 'purple'
  /** Display price in SEK (0 = free). Change freely — backend is unaffected. */
  monthlyPriceSEK: number
  /**
   * Stripe recurring price ID for this tier.
   * null  = free tier, no Stripe product.
   * The webhook identifies tiers via Stripe product metadata
   * { bliglomd_level: "2" } — never by this name.
   */
  stripeMonthlyPriceId: string | null
}

export const TIERS: Record<1 | 2 | 3, Tier> = {
  1: {
    key: 'trace',
    level: 1,
    name: 'Trace',
    tag: { sv: 'Gratis', en: 'Free' },
    tagline: {
      sv: 'Ditt digitala avtryck finns kvar — vi visar var.',
      en: 'Your digital trace is still out there — we show you where.',
    },
    description: {
      sv: 'Identifiera var dina uppgifter finns och få guidade instruktioner för varje företag. Skärma din e-post mot kända dataintrång.',
      en: 'Identify where your data exists and get guided instructions for each company. Scan your email against known data breaches.',
    },
    features: {
      sv: [
        'Sök bland 26+ företag',
        'Guidade GDPR-instruktioner',
        'Dataintrångsskanning',
      ],
      en: [
        'Search across 26+ companies',
        'Guided GDPR instructions',
        'Data breach scan',
      ],
    },
    timelineHint: {
      sv: 'Uppgradera till Cipher eller Ghost för att skicka direkt via BliGlömd.',
      en: 'Upgrade to Cipher or Ghost to send directly through BliGlömd.',
    },
    color: 'green',
    monthlyPriceSEK: 0,
    stripeMonthlyPriceId: null,
  },

  2: {
    key: 'cipher',
    level: 2,
    name: 'Cipher',
    tag: { sv: 'Cipher', en: 'Cipher' },
    tagline: {
      sv: 'Krypterat, skyddat, korrekt — klart på ett klick.',
      en: 'Encrypted, protected, correct — done in one click.',
    },
    description: {
      sv: 'Vi genererar ett juridiskt korrekt GDPR-brev åt dig. Kopiera och skicka direkt — vi sköter alla formuleringar.',
      en: 'We generate a legally correct GDPR letter for you. Copy-paste and send directly — we handle all the wording.',
    },
    features: {
      sv: [
        'Allt i Trace',
        'Automatiskt GDPR-brev (juridiskt korrekt)',
        'Kopia–klistra och skicka',
        'Spårning av svar',
      ],
      en: [
        'Everything in Trace',
        'Auto-generated GDPR letter (legally correct)',
        'Copy-paste and send',
        'Response tracking',
      ],
    },
    timelineHint: {
      sv: 'Uppgradera till Ghost för att låta BliGlömd skicka och bevaka automatiskt.',
      en: 'Upgrade to Ghost to let BliGlömd send and monitor automatically.',
    },
    color: 'blue',
    monthlyPriceSEK: 49,
    stripeMonthlyPriceId: 'price_1TnvuMAR7wxHkiWgUBaOpsgY',
  },

  3: {
    key: 'ghost',
    level: 3,
    name: 'Ghost',
    tag: { sv: 'Ghost', en: 'Ghost' },
    tagline: {
      sv: 'Du existerar inte längre online — vi ser till det.',
      en: 'You no longer exist online — we make sure of it.',
    },
    description: {
      sv: 'BliGlömd skickar, bevakar och följer upp åt dig. Automatisk påminnelse om företaget inte svarar inom 30 dagar.',
      en: 'BliGlömd sends, monitors, and follows up for you. Automatic reminder if the company does not respond within 30 days.',
    },
    features: {
      sv: [
        'Allt i Cipher',
        'BliGlömd skickar åt dig',
        'Automatisk uppföljning',
        'Påminnelse vid utebliven respons',
        'Fullständig radering på autopilot',
      ],
      en: [
        'Everything in Cipher',
        'BliGlömd sends for you',
        'Automatic follow-up',
        'Reminder on missed response',
        'Complete erasure on autopilot',
      ],
    },
    timelineHint: {
      sv: '',
      en: '',
    },
    color: 'purple',
    monthlyPriceSEK: 99,
    stripeMonthlyPriceId: 'price_1Tnvv0AR7wxHkiWgfK6Wl6eL',
  },
}

/** Convenience helper — look up a tier by its stable key */
export function tierByKey(key: Tier['key']): Tier {
  return Object.values(TIERS).find(t => t.key === key)!
}
