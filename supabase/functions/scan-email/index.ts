import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const email: string = body?.email ?? ''

    if (!email || !EMAIL_RE.test(email)) {
      return new Response(
        JSON.stringify({ breaches: [], error: 'Invalid email address' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
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
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!xonRes.ok) {
      throw new Error(`XposedOrNot API error: ${xonRes.status}`)
    }

    const data = await xonRes.json()
    const breaches = data?.ExposedBreaches?.breaches_details ?? []

    return new Response(
      JSON.stringify({ breaches }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ breaches: [], error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
