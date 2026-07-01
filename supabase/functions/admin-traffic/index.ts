import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED = new Set([
  'https://xn--bliglmd-e1a.se',
  'https://bliglömd.se',
  'http://localhost:5173',
  'http://localhost:4173',
])

const ADMIN_EMAIL = 'admin@xn--bliglmd-e1a.se'

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.has(origin) ? origin : 'https://xn--bliglmd-e1a.se',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

async function verifyAdmin(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await client.auth.getUser(token)
  // user_metadata is self-editable by any logged-in user — role alone is not a
  // safe boundary. The exact admin email is the real authorization check.
  if (!user || user.user_metadata?.role !== 'admin' || user.email !== ADMIN_EMAIL) return null
  return { user, client }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const h = cors(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })

  try {
    const ctx = await verifyAdmin(req)
    if (!ctx) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    const { client } = ctx

    const [
      { data: referrers },
      { data: landingPages },
      { data: exitPages },
      { data: funnelRows },
      { data: unmatchedSearches },
      { data: langSplit },
    ] = await Promise.all([
      client.rpc('admin_traffic_referrers'),
      client.rpc('admin_traffic_landing_pages'),
      client.rpc('admin_traffic_exit_pages'),
      client.rpc('admin_traffic_funnel'),
      client.rpc('admin_traffic_unmatched_searches'),
      client.rpc('admin_traffic_lang_split'),
    ])

    // Funnel stages in order — each stage's count is distinct sessions that ever reached it.
    const funnelMap = new Map((funnelRows ?? []).map((r: { event_type: string; distinct_sessions: number }) => [r.event_type, Number(r.distinct_sessions)]))
    const stages = [
      { key: 'pageview',          label: 'Besökare' },
      { key: 'scan_completed',    label: 'Genomförd skanning' },
      { key: 'signup_completed',  label: 'Skapat konto' },
      { key: 'checkout_completed', label: 'Betalande kund' },
      { key: 'request_sent',      label: 'Skickat förfrågan' },
    ]
    const funnel = stages.map((s) => ({ ...s, count: funnelMap.get(s.key) ?? 0 }))

    return new Response(JSON.stringify({
      referrers: referrers ?? [],
      landing_pages: landingPages ?? [],
      exit_pages: exitPages ?? [],
      funnel,
      unmatched_searches: unmatchedSearches ?? [],
      lang_split: langSplit ?? [],
      generated_at: new Date().toISOString(),
    }), { headers: { ...h, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
