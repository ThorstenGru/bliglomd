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

    const body = await req.json()
    const { userId, level } = body as { userId: string; level: number }

    if (!userId || ![1, 2, 3].includes(level)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    const { client, user: adminUser } = ctx

    const { error } = await client.from('profiles').update({ level }).eq('id', userId)
    if (error) throw error

    // Audit log
    await client.from('audit_logs').insert({
      user_id: adminUser.id,
      user_email: adminUser.email,
      action: 'admin_level_change',
      resource: userId,
      metadata: { new_level: level },
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
