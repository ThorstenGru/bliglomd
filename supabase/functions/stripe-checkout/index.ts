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

    // STRIPE_MODE is the single switch for going live: set to 'live' and both the
    // API key and the accepted price IDs move to their live-mode counterparts in
    // one atomic change, without overwriting (and losing) the sandbox values --
    // flipping back for testing stays possible. tiers.ts in the frontend must be
    // updated to send the matching mode's price IDs in the same deploy, or every
    // checkout attempt fails closed with "Invalid price" (safe, but broken).
    const live = Deno.env.get('STRIPE_MODE') === 'live'

    const subscriptionPrices = new Set([
      Deno.env.get(live ? 'STRIPE_CIPHER_PRICE_ID_LIVE' : 'STRIPE_CIPHER_PRICE_ID'),
      Deno.env.get(live ? 'STRIPE_GHOST_PRICE_ID_LIVE' : 'STRIPE_GHOST_PRICE_ID'),
    ])

    if (!priceId || !subscriptionPrices.has(priceId)) {
      return json({ error: 'Invalid price' }, 400, cors)
    }

    const STRIPE_KEY = Deno.env.get(live ? 'STRIPE_SECRET_KEY_LIVE' : 'STRIPE_SECRET_KEY')!
    const stripeAuth = `Basic ${btoa(STRIPE_KEY + ':')}`

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await sbAdmin
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, full_name')
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

    // Already on an active subscription (e.g. Cipher -> Ghost): swap the price on the
    // existing subscription instead of opening a new Checkout Session, which would create
    // a second subscription billing in parallel with the first rather than replacing it.
    if (profile?.stripe_subscription_id && profile.subscription_status === 'active') {
      const currentSubRes = await fetch(`${STRIPE_BASE}/subscriptions/${profile.stripe_subscription_id}`, {
        headers: { Authorization: stripeAuth },
      })
      const currentSub = await currentSubRes.json()
      const itemId = currentSub.items?.data?.[0]?.id

      if (currentSubRes.ok && itemId && currentSub.status !== 'canceled') {
        const updateRes = await fetch(`${STRIPE_BASE}/subscriptions/${profile.stripe_subscription_id}`, {
          method: 'POST',
          headers: { Authorization: stripeAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            'items[0][id]': itemId,
            'items[0][price]': priceId,
            proration_behavior: 'always_invoice',
          }),
        })
        const updated = await updateRes.json()
        if (!updateRes.ok) throw new Error(updated.error?.message ?? 'Failed to update subscription')

        // Write the new level ourselves rather than waiting on the customer.subscription.updated
        // webhook round-trip -- keeps the UI correct immediately even if webhook delivery lags.
        const level = await levelFromPrice(priceId, stripeAuth)
        if (level) {
          await sbAdmin.from('profiles').update({ level, subscription_status: 'active' }).eq('id', user.id)
        }

        return json({ url: null, updatedInPlace: true }, 200, cors)
      }
    }

    const sessionParams = new URLSearchParams({
      customer: customerId!,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      success_url: 'https://xn--bliglmd-e1a.se/dashboard?upgraded=1',
      cancel_url: 'https://xn--bliglmd-e1a.se/profile',
      client_reference_id: user.id,
      allow_promotion_codes: 'true',
      'subscription_data[metadata][supabase_user_id]': user.id,
    })

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

async function levelFromPrice(priceId: string, stripeAuth: string): Promise<number | null> {
  const res = await fetch(`${STRIPE_BASE}/prices/${priceId}?expand[]=product`, {
    headers: { Authorization: stripeAuth },
  })
  const price = await res.json()
  const raw = price.product?.metadata?.bliglomd_level
  return raw ? parseInt(raw, 10) : null
}
