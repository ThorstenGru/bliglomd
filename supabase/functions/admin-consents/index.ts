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
      { data: { users } },
      { data: checkoutConsents },
      { data: signupConsents },
    ] = await Promise.all([
      client.auth.admin.listUsers({ perPage: 1000 }),
      client.from('consent_records')
        .select('id, user_id, consented_at, terms_version, terms_snapshot, consent_text, price_id, consent_context')
        .order('consented_at', { ascending: false })
        .limit(500),
      client.from('signup_consent_records')
        .select('id, user_id, consented_at, terms_version, terms_snapshot, privacy_version, privacy_snapshot, consent_text')
        .order('consented_at', { ascending: false })
        .limit(500),
    ])

    const emailByUserId = new Map((users ?? []).map(u => [u.id, u.email ?? '']))

    const checkout = (checkoutConsents ?? []).map(c => ({ ...c, user_email: emailByUserId.get(c.user_id) ?? 'okänd' }))
    const signup = (signupConsents ?? []).map(c => ({ ...c, user_email: emailByUserId.get(c.user_id) ?? 'okänd' }))

    return new Response(JSON.stringify({ checkout_consents: checkout, signup_consents: signup }), {
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
