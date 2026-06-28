import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED = new Set([
  'https://xn--bliglmd-e1a.se',
  'https://bliglömd.se',
  'http://localhost:5173',
  'http://localhost:4173',
])

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
  if (!user || user.user_metadata?.role !== 'admin') return null
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

    const { client } = ctx

    const [
      { data: { users }, error: ue },
      { data: profiles },
      { data: reqs },
      { data: scans },
    ] = await Promise.all([
      client.auth.admin.listUsers({ perPage: 1000 }),
      client.from('profiles').select('id, full_name, level'),
      client.from('requests').select('user_id'),
      client.from('scans').select('user_id'),
    ])

    if (ue) throw ue

    const pm = new Map((profiles ?? []).map((p: { id: string; full_name: string; level: number }) => [p.id, p]))
    const rm = new Map<string, number>()
    const sm = new Map<string, number>()
    ;(reqs ?? []).forEach((r: { user_id: string }) => rm.set(r.user_id, (rm.get(r.user_id) ?? 0) + 1))
    ;(scans ?? []).forEach((s: { user_id: string }) => sm.set(s.user_id, (sm.get(s.user_id) ?? 0) + 1))

    const result = (users ?? []).map((u: { id: string; email?: string; created_at: string; last_sign_in_at?: string }) => ({
      id: u.id,
      email: u.email ?? '',
      full_name: (pm.get(u.id) as { full_name?: string } | undefined)?.full_name ?? '',
      level: (pm.get(u.id) as { level?: number } | undefined)?.level ?? 1,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      requests: rm.get(u.id) ?? 0,
      scans: sm.get(u.id) ?? 0,
    }))

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
