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

    const { client, user } = ctx
    const body = await req.json().catch(() => ({}))

    // Client-side direct insert into audit_logs was silently failing RLS for
    // this specific write (admin_delete/export/level_change all go through
    // service-role edge functions already — this brings admin_login in line
    // with that same proven-working pattern instead of a browser-side insert).
    const { error } = await client.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'admin_login',
      resource: null,
      metadata: { user_agent: typeof body.user_agent === 'string' ? body.user_agent.slice(0, 500) : null },
    })
    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
