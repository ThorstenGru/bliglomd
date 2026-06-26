import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ALLOWED_ORIGINS = new Set([
  'https://xn--bliglmd-e1a.se',
  'https://bliglömd.se',
  'http://localhost:5173',
  'http://localhost:4173',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://xn--bliglmd-e1a.se'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { companyName, gdprEmail, userName, userEmail } = body

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

    const mailBody = `Hej,

Jag utövar min rätt enligt GDPR Artikel 17 (rätten till radering) och begär att ni omgående raderar alla personuppgifter som ni behandlar avseende mig.

Namn: ${userName}
E-postadress: ${userEmail}

Vänligen bekräfta skriftligen när raderingen är genomförd, senast inom 30 dagar i enlighet med GDPR Artikel 12.

Med vänliga hälsningar,
${userName}`

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BliGlömd <noreply@bliglomd.se>',
        to: gdprEmail,
        reply_to: userEmail,
        subject: `Begäran om radering av personuppgifter – GDPR Artikel 17 (${companyName})`,
        text: mailBody,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(`Resend API error ${res.status}: ${JSON.stringify(data)}`)
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
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
