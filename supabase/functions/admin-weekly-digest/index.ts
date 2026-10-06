import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'admin@xn--bliglmd-e1a.se'

const ONE_DAY = 86_400_000
const WEEK    = 7 * ONE_DAY
const MONTH   = 30 * ONE_DAY

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function trend(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return ''
  const delta = cur - prev
  if (delta === 0) return '<span style="color:#64748B">= oförändrad</span>'
  const pct = prev > 0 ? Math.abs(Math.round((delta / prev) * 100)) : 100
  const arrow = delta > 0 ? '↑' : '↓'
  const color = delta > 0 ? '#16A34A' : '#DC2626'
  return `<span style="color:${color};font-weight:600">${arrow} ${Math.abs(delta)} (${pct}%)</span>`
}

type Traffic = {
  visits: number; visitsPrev: number; pageviews: number
  guideLanding: number; guideLandingPrev: number; ctaClicks: number
  topGuides: [string, number][]; topRefs: [string, number][]
}

function trafficHtml(t: Traffic): string {
  const list = (items: [string, number][]) => items.length === 0
    ? '<tr><td colspan="2" style="color:#94A3B8;font-size:12px">Ingen data ännu</td></tr>'
    : items.map(([k, n], i) =>
        `<tr><td style="padding:4px 0;color:#64748B;font-size:12px">${i + 1}. ${escapeHtml(k)}</td>
             <td style="padding:4px 0;font-weight:700;font-size:12px;text-align:right">${n}</td></tr>`).join('')
  const ctr = t.guideLanding > 0 ? Math.round((t.ctaClicks / t.guideLanding) * 100) : 0
  return `
  <table style="width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;margin-bottom:16px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:10px 16px;text-align:left;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Trafik (egen statistik)</th>
      <th style="padding:10px 16px;text-align:right;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Denna vecka</th>
      <th style="padding:10px 16px;text-align:right;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Trend</th>
    </tr></thead>
    <tbody>
      <tr style="border-top:1px solid #F1F5F9"><td style="padding:10px 16px;font-size:13px;color:#374151">Besök (sessioner)</td><td style="padding:10px 16px;font-size:14px;font-weight:700;text-align:right">${t.visits}</td><td style="padding:10px 16px;text-align:right;font-size:12px">${trend(t.visits, t.visitsPrev)}</td></tr>
      <tr style="border-top:1px solid #F1F5F9"><td style="padding:10px 16px;font-size:13px;color:#374151">Sidvisningar</td><td style="padding:10px 16px;font-size:14px;font-weight:700;text-align:right">${t.pageviews}</td><td></td></tr>
      <tr style="border-top:1px solid #F1F5F9"><td style="padding:10px 16px;font-size:13px;color:#374151">Besök som landar på en guide</td><td style="padding:10px 16px;font-size:14px;font-weight:700;text-align:right">${t.guideLanding}</td><td style="padding:10px 16px;text-align:right;font-size:12px">${trend(t.guideLanding, t.guideLandingPrev)}</td></tr>
      <tr style="border-top:1px solid #F1F5F9"><td style="padding:10px 16px;font-size:13px;color:#374151">Klick guide → skanning</td><td style="padding:10px 16px;font-size:14px;font-weight:700;text-align:right">${t.ctaClicks}</td><td style="padding:10px 16px;text-align:right;font-size:12px;color:#64748B">${ctr}% av guidebesök</td></tr>
    </tbody>
  </table>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:white;border-radius:10px;padding:16px 18px">
      <p style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Toppguider</p>
      <table style="width:100%">${list(t.topGuides)}</table>
    </div>
    <div style="background:white;border-radius:10px;padding:16px 18px">
      <p style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Källor (referrer)</p>
      <table style="width:100%">${list(t.topRefs)}</table>
    </div>
  </div>`
}

function buildDigestHtml(data: Record<string, unknown>, weekLabel: string): string {
  const s   = data.snapshot as Record<string, number>
  const traffic = data.traffic as Traffic
  const top = (data.top_companies as { company_name: string; cnt: number }[]).slice(0, 5)

  const rows = [
    ['Nya användare',              s.signups_this_week, s.signups_last_week],
    ['Förfrågningar skickade',     s.reqs_this_week,    s.reqs_last_week],
    ['Totalt aktiva ärenden',      s.active_reqs,       null],
    ['Fastnade ärenden (>30 dgr)', s.stale_reqs,        null],
  ] as [string, number, number | null][]

  const staleAlert = s.stale_reqs > 0
    ? `<div style="background:#FEF9C3;border-left:4px solid #F59E0B;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#92400E">
        ⚠️ <strong>${s.stale_reqs} ärenden</strong> har inte fått svar på 30+ dagar. Kontrollera status i admin-panelen.
       </div>`
    : ''

  const topRows = top.length === 0
    ? '<tr><td colspan="2" style="color:#94A3B8;font-size:12px">Inga förfrågningar ännu</td></tr>'
    : top.map((c, i) =>
        `<tr><td style="padding:5px 0;color:#64748B;font-size:13px">${i + 1}. ${escapeHtml(c.company_name)}</td>
             <td style="padding:5px 0;font-weight:700;font-size:13px;text-align:right">${c.cnt}</td></tr>`
      ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>BliGlömd Veckorapport</title></head>
<body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1E293B;background:#F8FAFC">

  <div style="background:#2563EB;border-radius:10px;padding:18px 22px;margin-bottom:24px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="color:white;font-size:15px;font-weight:700">🔒 BliGlömd Admin</span>
      <span style="color:#93C5FD;font-size:12px">Veckorapport · ${escapeHtml(weekLabel)}</span>
    </div>
  </div>

  ${staleAlert}

  <table style="width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;margin-bottom:16px">
    <thead>
      <tr style="background:#F8FAFC">
        <th style="padding:10px 16px;text-align:left;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Mätvärde</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Denna vecka</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Trend</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(([label, cur, prev]) =>
        `<tr style="border-top:1px solid #F1F5F9">
          <td style="padding:10px 16px;font-size:13px;color:#374151">${label}</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums">${cur}</td>
          <td style="padding:10px 16px;text-align:right;font-size:12px">${prev !== null ? trend(cur, prev) : ''}</td>
        </tr>`
      ).join('')}
    </tbody>
  </table>

  ${trafficHtml(traffic)}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:white;border-radius:10px;padding:16px 18px">
      <p style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Användare</p>
      <table style="width:100%;font-size:13px">
        <tr><td style="color:#64748B;padding:3px 0">Totalt</td><td style="font-weight:700;text-align:right">${s.total_users}</td></tr>
        <tr><td style="color:#64748B;padding:3px 0">MAU</td><td style="font-weight:700;text-align:right">${s.mau}</td></tr>
        <tr><td style="color:#64748B;padding:3px 0">WAU</td><td style="font-weight:700;text-align:right">${s.wau}</td></tr>
        <tr><td style="color:#64748B;padding:3px 0">DAU</td><td style="font-weight:700;text-align:right">${s.dau}</td></tr>
        <tr><td style="color:#64748B;padding:3px 0">Retention</td><td style="font-weight:700;text-align:right">${s.retention_pct}%</td></tr>
      </table>
    </div>
    <div style="background:white;border-radius:10px;padding:16px 18px">
      <p style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Intrång</p>
      <table style="width:100%;font-size:13px">
        <tr><td style="color:#64748B;padding:3px 0">Totalt funna</td><td style="font-weight:700;text-align:right">${s.total_breaches}</td></tr>
        <tr><td style="color:#64748B;padding:3px 0">Intrångsfrekvens</td><td style="font-weight:700;text-align:right">${s.breach_rate_pct}%</td></tr>
        <tr><td style="color:#64748B;padding:3px 0">Snitt/skanning</td><td style="font-weight:700;text-align:right">${s.avg_breaches}</td></tr>
        <tr><td style="color:#64748B;padding:3px 0">Snitt förfrågn/user</td><td style="font-weight:700;text-align:right">${s.avg_reqs_per_user}</td></tr>
      </table>
    </div>
  </div>

  <div style="background:white;border-radius:10px;padding:16px 18px;margin-bottom:24px">
    <p style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Topp 5 tjänster (alla tider)</p>
    <table style="width:100%">${topRows}</table>
  </div>

  <p style="font-size:11px;color:#CBD5E1;text-align:center;margin:0">
    BliGlömd Admin · Automatisk veckorapport · ${escapeHtml(weekLabel)}
  </p>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    // Verify digest secret — set via `supabase secrets set DIGEST_SECRET=<uuid>`.
    // Fails closed: a missing secret rejects every request instead of allowing them.
    const digestSecret = Deno.env.get('DIGEST_SECRET')
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!digestSecret || auth !== digestSecret) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const brevoKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoKey) {
      return new Response(JSON.stringify({ error: 'BREVO_API_KEY not set' }), { status: 500 })
    }

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now = Date.now()

    const [
      { data: { users } },
      { data: reqsPerDay },
      { data: topCompanies },
      { data: reqStatuses },
      { data: breachRows },
      { data: activeRows },
    ] = await Promise.all([
      client.auth.admin.listUsers({ perPage: 1000 }),
      client.rpc('admin_requests_per_day'),
      client.rpc('admin_top_companies'),
      client.rpc('admin_request_statuses'),
      client.rpc('admin_breach_stats'),
      client.rpc('admin_active_and_stale'),
    ])

    // The admin account is not a customer — exclude it from every customer-facing metric.
    const customerUsers = (users ?? []).filter(u => u.email !== ADMIN_EMAIL)

    let dau = 0, wau = 0, mau = 0, signupsThisWeek = 0, signupsLastWeek = 0
    for (const u of customerUsers) {
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

    const rd = (reqsPerDay ?? []) as { day: string; cnt: number }[]
    const reqsThisWeek = rd.filter(d => now - new Date(d.day).getTime() < WEEK).reduce((s, d) => s + Number(d.cnt), 0)
    const reqsLastWeek = rd.filter(d => { const a = now - new Date(d.day).getTime(); return a >= WEEK && a < 2 * WEEK }).reduce((s, d) => s + Number(d.cnt), 0)

    const breach = ((breachRows ?? []) as { total_scans: number; total_breaches: number; avg_breaches: number; scans_with_breach: number }[])[0]
      ?? { total_scans: 0, total_breaches: 0, avg_breaches: 0, scans_with_breach: 0 }
    const active = ((activeRows ?? []) as { active_cnt: number; stale_cnt: number }[])[0]
      ?? { active_cnt: 0, stale_cnt: 0 }
    const totalUsers = customerUsers.length
    const totalReqs  = ((reqStatuses ?? []) as { status: string; cnt: number }[]).reduce((s, r) => s + Number(r.cnt), 0)

    const snapshot = {
      dau, wau, mau,
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
        ? Math.round((Number(breach.scans_with_breach) / Number(breach.total_scans)) * 100) : 0,
      total_breaches: Number(breach.total_breaches),
      avg_breaches:   Number(breach.avg_breaches),
    }

    const sinceIso = new Date(now - 2 * WEEK).toISOString()
    const { data: evRows } = await client
      .from('analytics_events')
      .select('session_id, event_type, path, referrer_domain, metadata, created_at')
      .gte('created_at', sinceIso)
      .in('event_type', ['pageview', 'guide_cta_click'])
      .limit(50000)
    const events = (evRows ?? []) as { session_id: string; event_type: string; path: string | null; referrer_domain: string | null; metadata: Record<string, string> | null; created_at: string }[]
    const thisWk = events.filter(e => now - new Date(e.created_at).getTime() < WEEK)
    const prevWk = events.filter(e => now - new Date(e.created_at).getTime() >= WEEK)
    const isGuide = (p: string | null) => !!p && p.startsWith('/guider/')
    const tally = (arr: string[]) => Object.entries(arr.reduce<Record<string, number>>((m, k) => (m[k] = (m[k] ?? 0) + 1, m), {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][]
    const pvThis = thisWk.filter(e => e.event_type === 'pageview')
    const pvPrev = prevWk.filter(e => e.event_type === 'pageview')
    const landings = (arr: typeof pvThis) => arr.filter(e => e.metadata?.is_landing === 'true')
    const traffic = {
      visits:           new Set(pvThis.map(e => e.session_id)).size,
      visitsPrev:       new Set(pvPrev.map(e => e.session_id)).size,
      pageviews:        pvThis.length,
      guideLanding:     landings(pvThis).filter(e => isGuide(e.path)).length,
      guideLandingPrev: landings(pvPrev).filter(e => isGuide(e.path)).length,
      ctaClicks:        thisWk.filter(e => e.event_type === 'guide_cta_click').length,
      topGuides:        tally(pvThis.filter(e => isGuide(e.path)).map(e => e.path!)),
      topRefs:          tally(landings(pvThis).map(e => e.referrer_domain || 'Direkt/okänd')),
    }

    const weekLabel = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })

    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'BliGlömd System', email: 'noreply@xn--bliglmd-e1a.se' },
        to: [{ email: ADMIN_EMAIL }],
        subject: `[BliGlömd] Veckorapport — ${weekLabel}`,
        htmlContent: buildDigestHtml({ snapshot, top_companies: topCompanies ?? [], traffic }, weekLabel),
      }),
    })

    if (!emailRes.ok) {
      console.error('Brevo failed:', emailRes.status, await emailRes.text())
    }

    return new Response(JSON.stringify({ ok: true, sent_to: ADMIN_EMAIL, week: weekLabel }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
