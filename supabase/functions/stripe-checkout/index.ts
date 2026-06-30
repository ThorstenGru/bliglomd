import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://xn--bliglmd-e1a.se', 'http://localhost:5173']
const STRIPE_BASE = 'https://api.stripe.com/v1'

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
    const { data: { user }, error: authErr } = await sb.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401, cors)

    const { priceId } = await req.json()

    const subscriptionPrices = new Set([
      Deno.env.get('STRIPE_CIPHER_PRICE_ID'),
      Deno.env.get('STRIPE_GHOST_PRICE_ID'),
      Deno.env.get('STRIPE_CIPHER_ANNUAL_PRICE_ID'),
      Deno.env.get('STRIPE_GHOST_ANNUAL_PRICE_ID'),
    ])
    const onetimePrices = new Set([
      Deno.env.get('STRIPE_ONETIME_PRICE_ID'),
    ])
    const allValid = new Set([...subscriptionPrices, ...onetimePrices])

    if (!priceId || !allValid.has(priceId)) {
      return json({ error: 'Invalid price' }, 400, cors)
    }

    const isOnetime = onetimePrices.has(priceId)
    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
    const stripeAuth = `Basic ${btoa(STRIPE_KEY + ':')}`

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await sbAdmin
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const res = await fetch(`${STRIPE_BASE}/customers`, {
        method: 'POST',
        headers: { Authorization: stripeAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: user.email!,
          name: profile?.full_name ?? '',
          'metadata[supabase_user_id]': user.id,
        }),
      })
      const customer = await res.json()
      if (!customer.id) throw new Error(customer.error?.message ?? 'Failed to create customer')
      customerId = customer.id
      await sbAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const sessionParams = new URLSearchParams({
      customer: customerId!,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: isOnetime ? 'payment' : 'subscription',
      success_url: `https://xn--bliglmd-e1a.se/${isOnetime ? '?cleaned=1' : 'dashboard?upgraded=1'}`,
      cancel_url: 'https://xn--bliglmd-e1a.se/profile',
      client_reference_id: user.id,
      allow_promotion_codes: 'true',
    })

    if (!isOnetime) {
      sessionParams.append('subscription_data[metadata][supabase_user_id]', user.id)
    }

    const sessionRes = await fetch(`${STRIPE_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: { Authorization: stripeAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sessionParams,
    })
    const session = await sessionRes.json()
    if (!session.url) throw new Error(session.error?.message ?? 'No session URL')

    return json({ url: session.url }, 200, cors)
  } catch (err) {
    console.error('stripe-checkout error:', err)
    return json({ error: String(err) }, 500, cors)
  }
})

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
