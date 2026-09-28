import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'admin@xn--bliglmd-e1a.se'

const ALLOWED_ORIGINS = new Set([
  'https://xn--bliglmd-e1a.se',
  'https://bliglömd.se',
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://xn--bliglmd-e1a.se'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  // Verify the caller's JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  // The admin account is protected by a DB trigger too (belt and suspenders) —
  // this check just gives a clean error instead of a raw Postgres exception.
  if (user.email === ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'The admin account cannot be deleted' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  // Cancel any active Stripe subscription BEFORE deleting the account -- otherwise
  // the customer keeps being billed monthly with no account or stripe-portal access
  // left to stop it themselves. Best-effort: a Stripe failure here must not block
  // the actual account deletion (the user's GDPR right to erasure comes first);
  // it's logged so it can be caught and cancelled manually if it ever happens.
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .single()

  if (profile?.stripe_subscription_id) {
    const live = Deno.env.get('STRIPE_MODE') === 'live'
    const stripeKey = Deno.env.get(live ? 'STRIPE_SECRET_KEY_LIVE' : 'STRIPE_SECRET_KEY')
    if (stripeKey) {
      const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${btoa(stripeKey + ':')}` },
      })
      if (!cancelRes.ok) {
        console.error('Failed to cancel Stripe subscription on account deletion:', await cancelRes.text())
      }
    }
  }

  // Delete the auth user — CASCADE handles profiles, requests, scans, reminders
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...headers, 'Content-Type': 'application/json' } }
  )
})
