import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { zipSync } from 'https://esm.sh/fflate@0.8.2'

const ADMIN_EMAIL = 'admin@xn--bliglmd-e1a.se'
const PAGE_SIZE = 1000

// Guards against CSV/formula injection: a cell starting with =, +, -, @, tab or CR
// is interpreted as a formula by Excel/Sheets when the file is opened. Since this
// dump includes user-controlled text (company names, admin notes, etc.), prefix
// those with a single quote so they render as literal text instead of executing.
const FORMULA_LEAD = /^[=+\-@\t\r]/

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (FORMULA_LEAD.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

async function tableToCsv(
  client: ReturnType<typeof createClient>,
  table: string,
  columns: string[],
): Promise<string> {
  const lines = ['﻿' + columns.map(csvEscape).join(';')]

  let from = 0
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`)
    for (const row of data ?? []) {
      lines.push(columns.map(c => csvEscape((row as Record<string, unknown>)[c])).join(';'))
    }
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return lines.join('\r\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const dumpSecret = Deno.env.get('DB_DUMP_SECRET')
    if (dumpSecret) {
      const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (auth !== dumpSecret) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      }
    }

    const brevoKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoKey) return new Response(JSON.stringify({ error: 'BREVO_API_KEY not set' }), { status: 500 })

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: schema, error: schemaErr } = await client.rpc('admin_schema_snapshot')
    if (schemaErr) throw new Error(`Failed to read schema: ${schemaErr.message}`)

    const tables = (schema ?? []) as { table_name: string; columns: string[] }[]
    const files: Record<string, Uint8Array> = {}
    const rowCounts: Record<string, number> = {}

    for (const t of tables) {
      const csv = await tableToCsv(client, t.table_name, t.columns)
      files[`${t.table_name}.csv`] = new TextEncoder().encode(csv)
      rowCounts[t.table_name] = csv.split('\r\n').length - 1
    }

    const zipped = zipSync(files, { level: 6 })

    let zipBinary = ''
    const chunk = 0x8000
    for (let i = 0; i < zipped.length; i += chunk) {
      zipBinary += String.fromCharCode(...zipped.subarray(i, i + chunk))
    }
    const zipBase64 = btoa(zipBinary)

    const dateLabel = new Date().toISOString().slice(0, 10)
    const summary = Object.entries(rowCounts).map(([t, n]) => `${t}: ${n}`).join('<br/>')

    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'BliGlömd System', email: 'noreply@xn--bliglmd-e1a.se' },
        to: [{ email: ADMIN_EMAIL }],
        subject: `[BliGlömd] Veckovis databasdump — ${dateLabel}`,
        htmlContent: `<p>Databasdump (public-schema, CSV per tabell, zippad) — ${dateLabel}.</p><p>${summary}</p>`,
        attachment: [
          { content: zipBase64, name: `bliglomd-db-dump-${dateLabel}.zip` },
        ],
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Brevo failed:', emailRes.status, errText)
      return new Response(JSON.stringify({ ok: false, error: 'Email send failed', detail: errText }), { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true, sent_to: ADMIN_EMAIL, date: dateLabel, tables: rowCounts }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-weekly-db-dump error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
