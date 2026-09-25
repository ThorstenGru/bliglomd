import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { deflateSync } from 'https://esm.sh/fflate@0.8.2'

const ADMIN_EMAIL = 'admin@xn--bliglmd-e1a.se'
const PAGE_SIZE = 1000

// ── Encrypted ZIP (traditional PKWARE / "ZipCrypto") ────────────────────────
// This dump carries full customer PII, so it goes out password-protected —
// the password is mailed separately (and first) so the zip alone, sitting in
// an inbox, isn't enough to read it. ZipCrypto is the classic, universally
// compatible "enter a password to open this zip" scheme supported by 7-Zip,
// WinRAR, macOS Archive Utility, Python's zipfile, etc. It is NOT strong
// cryptography (known-plaintext attacks against it are well documented) --
// it raises the bar over a plaintext attachment, it is not a substitute for
// keeping the admin inbox itself secure.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crcStep(crc: number, byte: number): number {
  return (CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)) >>> 0
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) crc = crcStep(crc, data[i])
  return (crc ^ 0xFFFFFFFF) >>> 0
}

class ZipCryptoKeys {
  key0 = 0x12345678
  key1 = 0x23456789
  key2 = 0x34567890
  constructor(password: Uint8Array) {
    for (const b of password) this.update(b)
  }
  update(byte: number) {
    this.key0 = crcStep(this.key0, byte)
    this.key1 = (Math.imul((this.key1 + (this.key0 & 0xFF)) >>> 0, 134775813) + 1) >>> 0
    this.key2 = crcStep(this.key2, this.key1 >>> 24)
  }
  streamByte(): number {
    const temp = (this.key2 | 2) & 0xFFFF
    return (Math.imul(temp, temp ^ 1) >>> 8) & 0xFF
  }
  encrypt(byte: number): number {
    const cipher = (byte ^ this.streamByte()) & 0xFF
    this.update(byte)
    return cipher
  }
}

function encryptEntryData(password: string, plain: Uint8Array, crc: number): Uint8Array {
  const keys = new ZipCryptoKeys(new TextEncoder().encode(password))
  const header = new Uint8Array(12)
  crypto.getRandomValues(header)
  header[11] = (crc >>> 24) & 0xFF
  const out = new Uint8Array(12 + plain.length)
  for (let i = 0; i < 12; i++) out[i] = keys.encrypt(header[i])
  for (let i = 0; i < plain.length; i++) out[12 + i] = keys.encrypt(plain[i])
  return out
}

class ByteWriter {
  chunks: Uint8Array[] = []
  length = 0
  push(bytes: Uint8Array) { this.chunks.push(bytes); this.length += bytes.length }
  u16(v: number) { this.push(new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF])) }
  u32(v: number) { this.push(new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF])) }
  toBytes(): Uint8Array {
    const out = new Uint8Array(this.length)
    let off = 0
    for (const c of this.chunks) { out.set(c, off); off += c.length }
    return out
  }
}

function dosDateTime(): { time: number; date: number } {
  const now = new Date()
  const time = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | ((now.getSeconds() >> 1) & 0x1F)
  const date = (((now.getFullYear() - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0xF) << 5) | (now.getDate() & 0x1F)
  return { time, date }
}

function buildEncryptedZip(files: Record<string, Uint8Array>, password: string): Uint8Array {
  const { time, date } = dosDateTime()
  const local = new ByteWriter()
  const central = new ByteWriter()
  let entryCount = 0

  for (const [name, plain] of Object.entries(files)) {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(plain)
    const compressed = deflateSync(plain)
    const useDeflate = compressed.length < plain.length
    const dataForZip = useDeflate ? compressed : plain
    const method = useDeflate ? 8 : 0
    const encrypted = encryptEntryData(password, dataForZip, crc)
    const compSize = encrypted.length
    const offset = local.length

    local.u32(0x04034b50)
    local.u16(20)
    local.u16(0x0001)
    local.u16(method)
    local.u16(time)
    local.u16(date)
    local.u32(crc)
    local.u32(compSize)
    local.u32(plain.length)
    local.u16(nameBytes.length)
    local.u16(0)
    local.push(nameBytes)
    local.push(encrypted)
    entryCount++

    central.u32(0x02014b50)
    central.u16(20)
    central.u16(20)
    central.u16(0x0001)
    central.u16(method)
    central.u16(time)
    central.u16(date)
    central.u32(crc)
    central.u32(compSize)
    central.u32(plain.length)
    central.u16(nameBytes.length)
    central.u16(0)
    central.u16(0)
    central.u16(0)
    central.u16(0)
    central.u32(0)
    central.u32(offset)
    central.push(nameBytes)
  }

  const centralOffset = local.length
  const centralBytes = central.toBytes()

  const eocd = new ByteWriter()
  eocd.u32(0x06054b50)
  eocd.u16(0)
  eocd.u16(0)
  eocd.u16(entryCount)
  eocd.u16(entryCount)
  eocd.u32(centralBytes.length)
  eocd.u32(centralOffset)
  eocd.u16(0)

  const localBytes = local.toBytes()
  const eocdBytes = eocd.toBytes()
  const out = new Uint8Array(localBytes.length + centralBytes.length + eocdBytes.length)
  out.set(localBytes, 0)
  out.set(centralBytes, localBytes.length)
  out.set(eocdBytes, localBytes.length + centralBytes.length)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

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

    const dateLabel = new Date().toISOString().slice(0, 10)
    const password = crypto.randomUUID()
    const summary = Object.entries(rowCounts).map(([t, n]) => `${t}: ${n}`).join('<br/>')

    async function sendBrevo(body: Record<string, unknown>) {
      return fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey!, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    // 1) Password first, in its own email, before the zip is even built.
    const pwRes = await sendBrevo({
      sender: { name: 'BliGlömd System', email: 'noreply@xn--bliglmd-e1a.se' },
      to: [{ email: ADMIN_EMAIL }],
      subject: `[BliGlömd] Lösenord för veckans databasdump — ${dateLabel}`,
      htmlContent: `<p>Lösenordet för dagens databasdump (skickas i ett separat mejl) är:</p>
        <p style="font-size:18px;font-weight:700;font-family:monospace">${password}</p>`,
    })
    if (!pwRes.ok) {
      const errText = await pwRes.text()
      console.error('Brevo password email failed:', pwRes.status, errText)
      return new Response(JSON.stringify({ ok: false, error: 'Password email failed', detail: errText }), { status: 502 })
    }

    // 2) Build the encrypted zip and send it separately.
    const zipBytes = buildEncryptedZip(files, password)
    const zipBase64 = bytesToBase64(zipBytes)

    const emailRes = await sendBrevo({
      sender: { name: 'BliGlömd System', email: 'noreply@xn--bliglmd-e1a.se' },
      to: [{ email: ADMIN_EMAIL }],
      subject: `[BliGlömd] Veckovis databasdump — ${dateLabel}`,
      htmlContent: `<p>Databasdump (public-schema, CSV per tabell, lösenordsskyddad zip) — ${dateLabel}.</p><p>${summary}</p><p>Lösenordet skickades i föregående mejl.</p>`,
      attachment: [
        { content: zipBase64, name: `bliglomd-db-dump-${dateLabel}.zip` },
      ],
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Brevo dump email failed:', emailRes.status, errText)
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
