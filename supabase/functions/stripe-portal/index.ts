import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://xn--bliglmd-e1a.se', 'http://localhost:5173']

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const auth = req.headers.get('authorization')
    if (!auth) return json({ error: 'Unauthorized' }, 401, cors)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    )
    const { data: { user }, error } = await sb.auth.getUser()
    if (error || !user) return json({ error: 'Unauthorized' }, 401, cors)

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: profile } = await sbAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return json({ error: 'No active subscription' }, 400, cors)
    }

    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
    const stripeAuth = `Basic ${btoa(STRIPE_KEY + ':')}`

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: stripeAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        customer: profile.stripe_customer_id,
        return_url: 'https://xn--bliglmd-e1a.se/profile',
      }),
    })
    const session = await res.json()
    if (!session.url) throw new Error(session.error?.message ?? 'No portal URL')

    return json({ url: session.url }, 200, cors)
  } catch (err) {
    console.error('stripe-portal error:', err)
    return json({ error: String(err) }, 500, cors)
  }
})

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
