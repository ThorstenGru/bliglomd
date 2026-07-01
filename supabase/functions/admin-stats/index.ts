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

const ONE_DAY  = 86_400_000
const WEEK     = 7 * ONE_DAY
const MONTH    = 30 * ONE_DAY

// Monthly SEK price per tier — mirrors src/config/tiers.ts monthlyPriceSEK.
// Kept as a small constant here rather than importing the frontend config,
// since this is the only value this edge function needs from it.
const MONTHLY_PRICE_SEK: Record<number, number> = { 1: 0, 2: 61, 3: 124 }

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

    const { client, user: adminUser } = ctx

    // All queries in parallel for minimum latency
    const [
      { data: { users: allUsers }, error: ue },
      { data: signupsPerDay },
      { data: reqsPerDay },
      { data: scansPerDay },
      { data: topCompanies },
      { data: reqStatuses },
      { data: breachRows },
      { data: activeRows },
      { data: responseTimes },
      { data: staleRequests },
      { data: companyTrends },
      { data: billingProfiles },
    ] = await Promise.all([
      client.auth.admin.listUsers({ perPage: 1000 }),
      client.rpc('admin_signups_per_day'),
      client.rpc('admin_requests_per_day'),
      client.rpc('admin_scans_per_day'),
      client.rpc('admin_top_companies'),
      client.rpc('admin_request_statuses'),
      client.rpc('admin_breach_stats'),
      client.rpc('admin_active_and_stale'),
      client.rpc('admin_response_times'),
      client.rpc('admin_stale_requests'),
      client.rpc('admin_company_trends'),
      client.from('profiles').select('level, subscription_status'),
    ])

    if (ue) throw ue

    // The admin account is not a customer — exclude it from every customer-facing metric.
    const users = (allUsers ?? []).filter(u => u.id !== adminUser.id)

    // Compute DAU/WAU/MAU and signup trends from the full user list
    const now = Date.now()
    let dau = 0, wau = 0, mau = 0
    let signupsThisWeek = 0, signupsLastWeek = 0

    for (const u of users) {
      if (u.last_sign_in_at) {
        const ago = now - new Date(u.last_sign_in_at).getTime()
        if (ago < ONE_DAY) dau++
        if (ago < WEEK) wau++
        if (ago < MONTH) mau++
      }
      if (u.created_at) {
        const age = now - new Date(u.created_at).getTime()
        if (age < WEEK) signupsThisWeek++
        else if (age < 2 * WEEK) signupsLastWeek++
      }
    }

    // Week-over-week request trend from the per-day time series
    const rd = (reqsPerDay ?? []) as { day: string; cnt: number }[]
    const reqsThisWeek = rd
      .filter(d => now - new Date(d.day).getTime() < WEEK)
      .reduce((s, d) => s + Number(d.cnt), 0)
    const reqsLastWeek = rd
      .filter(d => { const age = now - new Date(d.day).getTime(); return age >= WEEK && age < 2 * WEEK })
      .reduce((s, d) => s + Number(d.cnt), 0)

    const breach = ((breachRows ?? []) as { total_scans: number; total_breaches: number; avg_breaches: number; scans_with_breach: number }[])[0]
      ?? { total_scans: 0, total_breaches: 0, avg_breaches: 0, scans_with_breach: 0 }
    const active = ((activeRows ?? []) as { active_cnt: number; stale_cnt: number }[])[0]
      ?? { active_cnt: 0, stale_cnt: 0 }

    const totalUsers = users.length
    const totalReqs  = ((reqStatuses ?? []) as { status: string; cnt: number }[])
      .reduce((s, r) => s + Number(r.cnt), 0)

    // MRR — approximate, since billing cycle (monthly vs annual) isn't tracked per
    // profile; this treats every active subscription as its tier's monthly price.
    const revenueByTier: Record<number, { active: number; mrr: number }> = {
      2: { active: 0, mrr: 0 },
      3: { active: 0, mrr: 0 },
    }
    for (const p of (billingProfiles ?? []) as { level: number; subscription_status: string }[]) {
      if (p.subscription_status === 'active' && (p.level === 2 || p.level === 3)) {
        revenueByTier[p.level].active++
        revenueByTier[p.level].mrr += MONTHLY_PRICE_SEK[p.level]
      }
    }
    const mrr = revenueByTier[2].mrr + revenueByTier[3].mrr

    const snapshot = {
      dau,
      wau,
      mau,
      retention_pct:    mau > 0 ? Math.round((wau / mau) * 100) : 0,
      total_users:      totalUsers,
      signups_this_week: signupsThisWeek,
      signups_last_week: signupsLastWeek,
      reqs_this_week:   reqsThisWeek,
      reqs_last_week:   reqsLastWeek,
      active_reqs:      Number(active.active_cnt),
      stale_reqs:       Number(active.stale_cnt),
      avg_reqs_per_user: totalUsers > 0 ? Math.round((totalReqs / totalUsers) * 10) / 10 : 0,
      breach_rate_pct:  Number(breach.total_scans) > 0
        ? Math.round((Number(breach.scans_with_breach) / Number(breach.total_scans)) * 100)
        : 0,
      total_breaches:   Number(breach.total_breaches),
      avg_breaches:     Number(breach.avg_breaches),
      mrr_sek:          mrr,
      revenue_by_tier:  revenueByTier,
    }

    return new Response(JSON.stringify({
      snapshot,
      signups_per_day:  signupsPerDay  ?? [],
      reqs_per_day:     reqsPerDay     ?? [],
      scans_per_day:    scansPerDay    ?? [],
      top_companies:    topCompanies   ?? [],
      request_statuses: reqStatuses    ?? [],
      response_times:   responseTimes  ?? [],
      stale_requests:   staleRequests  ?? [],
      company_trends:   companyTrends  ?? [],
      generated_at:     new Date().toISOString(),
    }), { headers: { ...h, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
