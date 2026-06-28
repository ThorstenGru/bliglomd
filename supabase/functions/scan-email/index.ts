const ALLOWED_ORIGINS = new Set([
  'https://xn--bliglmd-e1a.se',
  'https://bliglömd.se',
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://xn--bliglmd-e1a.se'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const email: string = body?.email ?? ''

    if (!email || !EMAIL_RE.test(email)) {
      return new Response(
        JSON.stringify({ breaches: [], error: 'Invalid email address' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    const xonRes = await fetch(
      `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`,
      {
        headers: { 'User-Agent': 'BliGlomd-GDPR-Tool/1.0' },
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (xonRes.status === 404) {
      // XposedOrNot returns 404 when no breaches found
      return new Response(
        JSON.stringify({ breaches: [] }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    if (!xonRes.ok) {
      throw new Error(`XposedOrNot API error: ${xonRes.status}`)
    }

    const data = await xonRes.json()
    const breaches = data?.ExposedBreaches?.breaches_details ?? []

    return new Response(
      JSON.stringify({ breaches }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ breaches: [], error: message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  }
})
