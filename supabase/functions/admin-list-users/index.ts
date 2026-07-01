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
        status: 403,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    const { client, user: adminUser } = ctx

    const [
      { data: { users }, error: ue },
      { data: profiles },
      { data: reqs },
      { data: scans },
    ] = await Promise.all([
      client.auth.admin.listUsers({ perPage: 1000 }),
      client.from('profiles').select('id, full_name, level, stripe_customer_id, stripe_subscription_id, subscription_status'),
      client.rpc('admin_request_counts'),
      client.rpc('admin_scan_counts'),
    ])

    if (ue) throw ue

    type Profile = { id: string; full_name: string; level: number; stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string }
    const pm = new Map((profiles ?? []).map((p: Profile) => [p.id, p]))
    const rm = new Map<string, number>()
    const sm = new Map<string, number>()
    ;(reqs ?? []).forEach((r: { user_id: string; cnt: number }) => rm.set(r.user_id, r.cnt))
    ;(scans ?? []).forEach((s: { user_id: string; cnt: number }) => sm.set(s.user_id, s.cnt))

    // The admin account is not a customer — never show it in the user list.
    const result = (users ?? [])
      .filter((u: { id: string }) => u.id !== adminUser.id)
      .map((u: { id: string; email?: string; created_at: string; last_sign_in_at?: string }) => {
        const p = pm.get(u.id) as Profile | undefined
        return {
          id: u.id,
          email: u.email ?? '',
          full_name: p?.full_name ?? '',
          level: p?.level ?? 1,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          requests: rm.get(u.id) ?? 0,
          scans: sm.get(u.id) ?? 0,
          subscription_status: p?.subscription_status ?? 'inactive',
          stripe_customer_id: p?.stripe_customer_id ?? null,
          stripe_subscription_id: p?.stripe_subscription_id ?? null,
        }
      })

    return new Response(JSON.stringify({ users: result }), {
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
