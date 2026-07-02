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

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
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
        sender: { name: 'BliGlömd', email: 'noreply@xn--bliglmd-e1a.se' },
        to: [{ email: gdprEmail }],
        replyTo: { email: userEmail },
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
