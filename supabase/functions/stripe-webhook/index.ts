import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { levelFromPrice } from '../_shared/stripeLevel.ts'

const STRIPE_BASE = 'https://api.stripe.com/v1'

// Fixed-length XOR-accumulate compare -- avoids a timing side-channel on the
// signature check (a plain === can leak how many leading hex chars matched).
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifySignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',')
  const t = parts.find(p => p.startsWith('t='))?.slice(2)
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3)
  if (!t || !v1) return false

  // Reject stale signatures to stop replay -- an HMAC signature never expires on
  // its own, so without this a previously-valid (payload, signature) pair -- e.g.
  // ever captured in a log or proxy -- would stay usable forever. 5 minutes
  // matches Stripe's own recommended tolerance window.
  const timestamp = parseInt(t, 10)
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false

  const signed = `${t}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return constantTimeEqual(computed, v1)
}

Deno.serve(async (req) => {
  const payload = await req.text()
  const sigHeader = req.headers.get('stripe-signature') ?? ''

  // Stripe signs sandbox and live events with different secrets but delivers both
  // to this same endpoint (one webhook registered per mode). Try sandbox first
  // (the common case today), then live, before rejecting.
  const sandboxSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  const liveSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE') ?? ''

  const verifiedSandbox = sandboxSecret ? await verifySignature(payload, sigHeader, sandboxSecret) : false
  const verifiedLive = !verifiedSandbox && liveSecret ? await verifySignature(payload, sigHeader, liveSecret) : false

  if (!verifiedSandbox && !verifiedLive) {
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(payload)

  // Use the matching-mode Stripe key for follow-up API calls -- a sandbox key can
  // never read live-mode objects (and vice versa), so this must track verification,
  // not just event.livemode, in case the two ever disagree.
  const STRIPE_KEY = verifiedLive
    ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')!
    : Deno.env.get('STRIPE_SECRET_KEY')!
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
        if (!level) {
          console.error(`checkout.session.completed: could not resolve level for price ${priceId} (user ${userId}, subscription ${session.subscription})`)
          break
        }

        const { error } = await sb.from('profiles').update({
          level,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_status: 'active',
        }).eq('id', userId)
        if (error) console.error(`checkout.session.completed: profile update failed for user ${userId}:`, error.message)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const priceId = sub.items?.data?.[0]?.price?.id
        const priceLevel = priceId ? await levelFromPrice(priceId, stripeAuth) : null
        const isActive = sub.status === 'active'
        const status = isActive ? 'active'
          : sub.status === 'past_due' ? 'past_due' : 'inactive'

        // Paid-tier access requires a currently active subscription -- any other
        // status (past_due, unpaid, incomplete, paused, etc.) drops the user back
        // to the free tier immediately, not just at final cancellation. Recovery
        // happens via invoice.payment_succeeded restoring the level once billing
        // actually succeeds again.
        if (isActive && !priceLevel) {
          // Don't write a row that says "active" while leaving level stale -- that
          // inconsistent combination is exactly what stripe-checkout's in-place-swap
          // check reads to decide its own behavior. Fail closed and log instead.
          console.error(`customer.subscription.updated: active subscription ${sub.id} but could not resolve level for price ${priceId} -- skipping update`)
          break
        }
        const level = isActive ? priceLevel : 1

        const updates: Record<string, unknown> = {
          stripe_subscription_id: sub.id,
          subscription_status: status,
        }
        if (level) updates.level = level

        const { error } = await sb.from('profiles').update(updates).eq('stripe_customer_id', sub.customer)
        if (error) console.error(`customer.subscription.updated: profile update failed for customer ${sub.customer}:`, error.message)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { error } = await sb.from('profiles').update({
          level: 1,
          stripe_subscription_id: null,
          subscription_status: 'canceled',
        }).eq('stripe_customer_id', sub.customer)
        if (error) console.error(`customer.subscription.deleted: profile update failed for customer ${sub.customer}:`, error.message)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.subscription) {
          // Restore the correct tier level here too, not just the status -- this is
          // what un-does a payment_failed downgrade once a retry actually succeeds.
          const subRes = await fetch(`${STRIPE_BASE}/subscriptions/${invoice.subscription}`, {
            headers: { Authorization: stripeAuth },
          })
          const sub = await subRes.json()
          const priceId = sub.items?.data?.[0]?.price?.id
          const level = priceId ? await levelFromPrice(priceId, stripeAuth) : null
          if (!level) {
            console.error(`invoice.payment_succeeded: could not resolve level for price ${priceId} (customer ${invoice.customer}) -- skipping update`)
            break
          }

          const { error } = await sb.from('profiles').update({ subscription_status: 'active', level })
            .eq('stripe_customer_id', invoice.customer)
          if (error) console.error(`invoice.payment_succeeded: profile update failed for customer ${invoice.customer}:`, error.message)
        }
        break
      }

      case 'invoice.payment_failed': {
        // Immediate downgrade to the free tier on any failed payment -- no grace
        // period. If a later retry succeeds, invoice.payment_succeeded above
        // restores the correct level.
        const invoice = event.data.object
        const { error } = await sb.from('profiles').update({ level: 1, subscription_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer)
        if (error) console.error(`invoice.payment_failed: profile update failed for customer ${invoice.customer}:`, error.message)
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
