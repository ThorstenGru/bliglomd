import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_BASE = 'https://api.stripe.com/v1'

async function verifySignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',')
  const t = parts.find(p => p.startsWith('t='))?.slice(2)
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3)
  if (!t || !v1) return false
  const signed = `${t}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === v1
}

async function levelFromPrice(priceId: string, stripeAuth: string): Promise<number | null> {
  const res = await fetch(`${STRIPE_BASE}/prices/${priceId}?expand[]=product`, {
    headers: { Authorization: stripeAuth },
  })
  const price = await res.json()
  const raw = price.product?.metadata?.bliglomd_level
  return raw ? parseInt(raw, 10) : null
}

Deno.serve(async (req) => {
  const payload = await req.text()
  const sigHeader = req.headers.get('stripe-signature') ?? ''
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  if (!(await verifySignature(payload, sigHeader, secret))) {
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(payload)
  const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
  const stripeAuth = `Basic ${btoa(STRIPE_KEY + ':')}`

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        const userId: string = session.client_reference_id
          ?? session.metadata?.supabase_user_id
          ?? session.subscription_data?.metadata?.supabase_user_id
        if (!userId) break

        const subRes = await fetch(`${STRIPE_BASE}/subscriptions/${session.subscription}`, {
          headers: { Authorization: stripeAuth },
        })
        const sub = await subRes.json()
        const priceId = sub.items?.data?.[0]?.price?.id
        const level = priceId ? await levelFromPrice(priceId, stripeAuth) : null
        if (!level) break

        await sb.from('profiles').update({
          level,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_status: 'active',
        }).eq('id', userId)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const priceId = sub.items?.data?.[0]?.price?.id
        const level = priceId ? await levelFromPrice(priceId, stripeAuth) : null
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due' : 'inactive'

        const updates: Record<string, unknown> = {
          stripe_subscription_id: sub.id,
          subscription_status: status,
        }
        if (level) updates.level = level

        await sb.from('profiles').update(updates).eq('stripe_customer_id', sub.customer)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await sb.from('profiles').update({
          level: 1,
          stripe_subscription_id: null,
          subscription_status: 'canceled',
        }).eq('stripe_customer_id', sub.customer)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.subscription) {
          await sb.from('profiles').update({ subscription_status: 'active' })
            .eq('stripe_customer_id', invoice.customer)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        await sb.from('profiles').update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
