import { supabase } from './supabase'

// First-party, cookie-free analytics. session_id lives only in sessionStorage
// (cleared when the tab closes) — it groups events within a single visit and
// never identifies a person across visits or sites. See Privacy Policy §2/§9.

const SESSION_KEY = 'bliglomd-session-id'
const LANDING_KEY = 'bliglomd-landing-logged'

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function referrerDomain(referrer: string): string {
  if (!referrer) return ''
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    // Internal navigation isn't a real referral source.
    if (host.endsWith('bliglömd.se') || host.endsWith('xn--bliglmd-e1a.se')) return ''
    return host
  } catch {
    return ''
  }
}

async function logEvent(eventType: string, fields: Record<string, unknown> = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('analytics_events').insert({
      session_id: getSessionId(),
      user_id: user?.id ?? null,
      event_type: eventType,
      ...fields,
    })
  } catch {
    // Analytics must never break the app for the visitor.
  }
}

/** Call on every route change. Captures referrer/UTM only once per session (the landing page). */
export function trackPageview(path: string, lang: string) {
  const isLanding = !sessionStorage.getItem(LANDING_KEY)
  if (isLanding) sessionStorage.setItem(LANDING_KEY, '1')

  const params = new URLSearchParams(window.location.search)
  logEvent('pageview', {
    path,
    lang,
    referrer: isLanding ? document.referrer.slice(0, 500) || null : null,
    referrer_domain: isLanding ? referrerDomain(document.referrer) || null : null,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    metadata: { is_landing: isLanding ? 'true' : 'false' },
  })
}

/** Company search in the Scan directory that matched nothing — a direct signal for what to add next. */
export function trackSearchNoMatch(term: string) {
  const trimmed = term.trim()
  if (!trimmed) return
  logEvent('search_no_match', { search_term: trimmed.slice(0, 200) })
}

/** Named funnel milestones: scan_completed, signup_started, signup_completed, checkout_started, checkout_completed, request_sent. */
export function trackFunnel(eventType: string, metadata: Record<string, unknown> = {}) {
  logEvent(eventType, { metadata })
}
