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
    const { userId } = body as { userId: string }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    const { client, user: adminUser } = ctx

    // Fetch all user data in parallel
    const [
      { data: { user: authUser } },
      { data: profile },
      { data: requests },
      { data: scans },
    ] = await Promise.all([
      client.auth.admin.getUserById(userId),
      client.from('profiles').select('*').eq('id', userId).single(),
      client.from('requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('scans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    if (!authUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    // Audit log
    await client.from('audit_logs').insert({
      user_id: adminUser.id,
      user_email: adminUser.email,
      action: 'admin_export',
      resource: userId,
      metadata: { exported_email: authUser?.email },
    })

    const snapshot = {
      exported_at: new Date().toISOString(),
      exported_by: adminUser.email,
      user: {
        id: authUser?.id,
        email: authUser?.email,
        created_at: authUser?.created_at,
        last_sign_in_at: authUser?.last_sign_in_at,
      },
      profile,
      requests,
      scans,
    }

    return new Response(JSON.stringify(snapshot), {
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
