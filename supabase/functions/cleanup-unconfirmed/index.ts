import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UNCONFIRMED_TTL_MS = 10 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    // Verify cleanup secret — set via `supabase secrets set CLEANUP_SECRET=<uuid>`
    const cleanupSecret = Deno.env.get('CLEANUP_SECRET')
    if (cleanupSecret) {
      const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (auth !== cleanupSecret) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const cutoff = Date.now() - UNCONFIRMED_TTL_MS
    const deletedIds: string[] = []
    let page = 1
    const perPage = 200

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
      if (error) throw error

      const stale = data.users.filter(
        (u) => !u.email_confirmed_at && new Date(u.created_at).getTime() < cutoff
      )
      for (const u of stale) {
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
        if (!delErr) deletedIds.push(u.id)
      }

      if (data.users.length < perPage) break
      page++
    }

    return new Response(JSON.stringify({ ok: true, deleted_count: deletedIds.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500 })
  }
})
