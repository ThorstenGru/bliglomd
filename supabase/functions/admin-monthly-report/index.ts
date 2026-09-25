import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const ADMIN_EMAIL = 'admin@xn--bliglmd-e1a.se'
const STRIPE_BASE = 'https://api.stripe.com/v1'

const LEVEL_NAME: Record<number, string> = { 1: 'Trace', 2: 'Cipher', 3: 'Ghost' }

interface PurchaseRow {
  date: string
  customerEmail: string
  customerName: string
  plan: string
  amount: number
  currency: string
  invoiceId: string
  status: string
}

// Stripe caps `expand` chains at 4 levels, so the invoice list request can reach
// data.lines.data.price (4) but not .product (5). Instead, resolve price -> level
// once via a separate, shallow-expanded /v1/prices call and look up by price id.
async function fetchPriceLevelMap(stripeAuth: string): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  let startingAfter: string | undefined

  for (;;) {
    const params = new URLSearchParams({ limit: '100', 'expand[0]': 'data.product' })
    if (startingAfter) params.set('starting_after', startingAfter)

    const res = await fetch(`${STRIPE_BASE}/prices?${params.toString()}`, {
      headers: { Authorization: stripeAuth },
    })
    const page = await res.json()
    if (!res.ok) throw new Error(page.error?.message ?? 'Failed to list Stripe prices')

    for (const price of page.data ?? []) {
      const raw = price.product?.metadata?.bliglomd_level
      if (raw) map[price.id] = parseInt(raw, 10)
    }

    if (!page.has_more || !page.data?.length) break
    startingAfter = page.data[page.data.length - 1].id
  }

  return map
}

async function fetchPaidInvoices(stripeAuth: string, gte: number, lt: number): Promise<PurchaseRow[]> {
  const priceLevelMap = await fetchPriceLevelMap(stripeAuth)
  const rows: PurchaseRow[] = []
  let startingAfter: string | undefined

  for (;;) {
    const params = new URLSearchParams({
      status: 'paid',
      'created[gte]': String(gte),
      'created[lt]': String(lt),
      limit: '100',
      'expand[0]': 'data.customer',
      'expand[1]': 'data.lines.data.price',
    })
    if (startingAfter) params.set('starting_after', startingAfter)

    const res = await fetch(`${STRIPE_BASE}/invoices?${params.toString()}`, {
      headers: { Authorization: stripeAuth },
    })
    const page = await res.json()
    if (!res.ok) throw new Error(page.error?.message ?? 'Failed to list Stripe invoices')

    for (const inv of page.data ?? []) {
      const line = inv.lines?.data?.[0]
      const level = line?.price?.id ? priceLevelMap[line.price.id] : undefined
      rows.push({
        date: new Date(inv.created * 1000).toISOString().slice(0, 10),
        customerEmail: inv.customer?.email ?? inv.customer_email ?? '',
        customerName: inv.customer?.name ?? '',
        plan: level ? (LEVEL_NAME[level] ?? `Level ${level}`) : (line?.price?.nickname ?? 'Okänd'),
        amount: (inv.amount_paid ?? 0) / 100,
        currency: String(inv.currency ?? '').toUpperCase(),
        invoiceId: inv.id,
        status: inv.status,
      })
    }

    if (!page.has_more || !page.data?.length) break
    startingAfter = page.data[page.data.length - 1].id
  }

  return rows
}

// Guards against CSV/formula injection when opened in Excel — see admin-weekly-db-dump for detail.
const FORMULA_LEAD = /^[=+\-@\t\r]/

function buildCsv(rows: PurchaseRow[]): string {
  const header = ['Datum', 'Kund (e-post)', 'Kund (namn)', 'Plan', 'Belopp', 'Valuta', 'Faktura-ID', 'Status']
  const esc = (v: string) => `"${(FORMULA_LEAD.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
  const lines = [header.join(';')]
  for (const r of rows) {
    lines.push([
      r.date, esc(r.customerEmail), esc(r.customerName), r.plan,
      r.amount.toFixed(2), r.currency, r.invoiceId, r.status,
    ].join(';'))
  }
  return '﻿' + lines.join('\r\n')
}

async function buildPdf(rows: PurchaseRow[], monthLabel: string, totalsByCurrency: Record<string, number>, countByPlan: Record<string, number>): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const margin = 40
  const pageWidth = 595.28 // A4 portrait, points
  const pageHeight = 841.89
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function drawText(text: string, x: number, size: number, useBold = false, color = rgb(0.1, 0.15, 0.25)) {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color })
  }

  function newPageIfNeeded(minY: number) {
    if (y < minY) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  drawText('BliGlömd — Månadsrapport', margin, 18, true)
  y -= 22
  drawText(monthLabel, margin, 12)
  y -= 30

  drawText('Sammanfattning', margin, 13, true)
  y -= 18
  drawText(`Antal köp: ${rows.length}`, margin, 11)
  y -= 15
  for (const [plan, cnt] of Object.entries(countByPlan)) {
    drawText(`  ${plan}: ${cnt}`, margin, 11)
    y -= 15
  }
  for (const [currency, total] of Object.entries(totalsByCurrency)) {
    drawText(`Totalt (${currency}): ${total.toFixed(2)}`, margin, 11, true)
    y -= 15
  }
  y -= 15

  drawText('Detaljerad lista', margin, 13, true)
  y -= 18

  const cols = [
    { label: 'Datum', x: margin, w: 60 },
    { label: 'Kund', x: margin + 60, w: 160 },
    { label: 'Plan', x: margin + 220, w: 60 },
    { label: 'Belopp', x: margin + 280, w: 70 },
    { label: 'Faktura-ID', x: margin + 350, w: 150 },
  ]
  function drawRow(cells: string[], useBold = false) {
    cols.forEach((c, i) => {
      const text = (cells[i] ?? '').slice(0, 32)
      page.drawText(text, { x: c.x, y, size: 9, font: useBold ? bold : font, color: rgb(0.15, 0.2, 0.3) })
    })
    y -= 14
  }

  drawRow(cols.map(c => c.label), true)
  y -= 4

  if (rows.length === 0) {
    drawText('Inga köp under perioden.', margin, 10)
    y -= 14
  }

  for (const r of rows) {
    newPageIfNeeded(margin + 20)
    drawRow([r.date, r.customerEmail || r.customerName, r.plan, `${r.amount.toFixed(2)} ${r.currency}`, r.invoiceId])
  }

  return doc.save()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const reportSecret = Deno.env.get('MONTHLY_REPORT_SECRET')
    if (reportSecret) {
      const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (auth !== reportSecret) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      }
    }

    const brevoKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoKey) return new Response(JSON.stringify({ error: 'BREVO_API_KEY not set' }), { status: 500 })

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY_LIVE')
    if (!stripeKey) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY_LIVE not set' }), { status: 500 })
    const stripeAuth = `Basic ${btoa(stripeKey + ':')}`

    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthLabel = periodStart.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', timeZone: 'UTC' })

    const rows = await fetchPaidInvoices(stripeAuth, Math.floor(periodStart.getTime() / 1000), Math.floor(periodEnd.getTime() / 1000))

    const totalsByCurrency: Record<string, number> = {}
    const countByPlan: Record<string, number> = {}
    for (const r of rows) {
      totalsByCurrency[r.currency] = (totalsByCurrency[r.currency] ?? 0) + r.amount
      countByPlan[r.plan] = (countByPlan[r.plan] ?? 0) + 1
    }

    const csv = buildCsv(rows)
    const pdfBytes = await buildPdf(rows, monthLabel, totalsByCurrency, countByPlan)

    const fileTag = `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`
    const totalsLine = Object.entries(totalsByCurrency).map(([c, t]) => `${t.toFixed(2)} ${c}`).join(', ') || '0'

    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'BliGlömd System', email: 'noreply@xn--bliglmd-e1a.se' },
        to: [{ email: ADMIN_EMAIL }],
        subject: `[BliGlömd] Månadsrapport — ${monthLabel}`,
        htmlContent: `<p>Månadsrapport för <strong>${monthLabel}</strong>.</p>
          <p>Antal köp: ${rows.length}<br/>Totalt: ${totalsLine}</p>
          <p>Se bifogade filer (CSV och PDF) för detaljer.</p>`,
        attachment: [
          { content: bytesToBase64(new TextEncoder().encode(csv)), name: `bliglomd-rapport-${fileTag}.csv` },
          { content: bytesToBase64(pdfBytes), name: `bliglomd-rapport-${fileTag}.pdf` },
        ],
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Brevo failed:', emailRes.status, errText)
      return new Response(JSON.stringify({ ok: false, error: 'Email send failed', detail: errText }), { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true, sent_to: ADMIN_EMAIL, month: monthLabel, purchases: rows.length, totals: totalsByCurrency }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-monthly-report error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
