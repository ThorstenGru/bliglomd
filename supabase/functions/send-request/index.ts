import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://xn--bliglmd-e1a.se',
  'https://bliglömd.se',
  'http://localhost:5173',
  'http://localhost:4173',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GHOST_LEVEL = 3

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://xn--bliglmd-e1a.se'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // Ghost-tier only: require a logged-in user whose profile is actually on level 3.
    // (The UI already hides this behind an upgrade prompt for lower tiers — this is the
    // server-side check that makes that enforceable rather than just a UI suggestion, and
    // stops this endpoint from being an open, unauthenticated way to send arbitrary email.)
    const auth = req.headers.get('authorization')
    if (!auth) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    )
    const { data: { user }, error: authErr } = await sb.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await sb.from('profiles').select('level').eq('id', user.id).single()
    if (!profile || profile.level < GHOST_LEVEL) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ghost subscription required' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { companyName, gdprEmail, userName, userEmail, lang } = body

    // Input validation
    if (!companyName || typeof companyName !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'companyName is required' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }
    if (!gdprEmail || !EMAIL_RE.test(gdprEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid gdprEmail' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }
    if (!userName || typeof userName !== 'string' || userName.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'userName must be at least 2 characters' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }
    if (!userEmail || !EMAIL_RE.test(userEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid userEmail' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    const isEnglish = lang === 'en'

    const mailBody = isEnglish
      ? `Hello,\n\nI am exercising my right under GDPR Article 17 (right to erasure) and request that you immediately delete all personal data that you process concerning me.\n\nName: ${userName}\nEmail address: ${userEmail}\n\nPlease confirm in writing when the deletion is complete, no later than 30 days in accordance with GDPR Article 12.\n\nKind regards,\n${userName}`
      : `Hej,\n\nJag utövar min rätt enligt GDPR Artikel 17 (rätten till radering) och begär att ni omgående raderar alla personuppgifter som ni behandlar avseende mig.\n\nNamn: ${userName}\nE-postadress: ${userEmail}\n\nVänligen bekräfta skriftligen när raderingen är genomförd, senast inom 30 dagar i enlighet med GDPR Artikel 12.\n\nMed vänliga hälsningar,\n${userName}`

    const subject = isEnglish
      ? `Personal data deletion request – GDPR Article 17 (${companyName})`
      : `Begäran om radering av personuppgifter – GDPR Artikel 17 (${companyName})`

    const apiKey = Deno.env.get('BREVO_API_KEY')
    if (!apiKey) {
      throw new Error('BREVO_API_KEY is not configured')
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Sent as the user, not as BliGlömd acting on their behalf: display name leads with
        // their own name (Brevo requires an authenticated sending domain for deliverability,
        // so the address itself stays ours — but replyTo below routes any response straight
        // to the user, and the message body is signed by them, never by BliGlömd).
        sender: { name: `${userName} via BliGlömd`, email: 'noreply@xn--bliglmd-e1a.se' },
        to: [{ email: gdprEmail }],
        replyTo: { email: userEmail, name: userName },
        subject,
        textContent: mailBody,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(`Brevo API error ${res.status}: ${JSON.stringify(data)}`)
    }

    return new Response(
      JSON.stringify({ success: true, id: data.messageId }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  }
})
