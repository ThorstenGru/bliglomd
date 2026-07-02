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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildEmailHtml(snapshot: Record<string, unknown>): string {
  const u = snapshot.user as Record<string, string> | undefined
  const profile = snapshot.profile as Record<string, unknown> | undefined
  const requests = (snapshot.requests as unknown[]) ?? []
  const scans = (snapshot.scans as unknown[]) ?? []

  const safeJson = escapeHtml(JSON.stringify(snapshot, null, 2))

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Raderingsrapport</title></head>
<body style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#1E293B">
  <div style="background:#FEE2E2;border-radius:8px;padding:14px 20px;margin-bottom:24px">
    <strong style="color:#DC2626">GDPR Raderingsrapport</strong> — BliGlömd Admin
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr><td style="padding:6px 0;color:#64748B;width:160px">Raderad användare</td><td style="font-weight:600">${escapeHtml(String(u?.email ?? '—'))}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Namn</td><td>${escapeHtml(String(profile?.full_name ?? '—'))}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Prenumerationsnivå</td><td>L${Number(profile?.level ?? 0)}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Registrerad</td><td>${escapeHtml(String(u?.created_at ?? '—'))}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Senast inloggad</td><td>${escapeHtml(String(u?.last_sign_in_at ?? 'Aldrig'))}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Totalt förfrågningar</td><td>${requests.length}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Totalt skanningar</td><td>${scans.length}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Raderades av</td><td>${escapeHtml(String(snapshot.deleted_by ?? '—'))}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">Tidpunkt</td><td>${escapeHtml(String(snapshot.deleted_at ?? '—'))}</td></tr>
  </table>
  <details>
    <summary style="cursor:pointer;color:#2563EB;font-weight:600;margin-bottom:8px">Komplett datasnapshot (JSON)</summary>
    <pre style="background:#F8FAFC;padding:16px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap">${safeJson}</pre>
  </details>
</body>
</html>`
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const h = cors(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })

  try {
    const ctx = await verifyAdmin(req)
    if (!ctx) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { userId } = body as { userId: string }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    const { client, user: adminUser } = ctx

    // The admin account is protected by a DB trigger too (belt and suspenders) —
    // this check just gives a clean error instead of a raw Postgres exception.
    if (userId === adminUser.id) {
      return new Response(JSON.stringify({ error: 'The admin account cannot be deleted' }), {
        status: 403,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    // 1. Gather snapshot before deletion
    const [
      { data: { user: authUser } },
      { data: profile },
      { data: requests },
      { data: scans },
    ] = await Promise.all([
      client.auth.admin.getUserById(userId),
      client.from('profiles').select('*').eq('id', userId).single(),
      client.from('requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('scans').select('id, scan_email, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    if (!authUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...h, 'Content-Type': 'application/json' },
      })
    }

    const snapshot = {
      deleted_at: new Date().toISOString(),
      deleted_by: adminUser.email,
      user: {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
      },
      profile,
      requests,
      scans,
    }

    // 2. Save permanent deletion record
    await client.from('admin_deletions').insert({
      deleted_user_id: userId,
      deleted_user_email: authUser.email ?? '',
      deleted_by_email: adminUser.email ?? 'admin',
      snapshot,
    })

    // 3. Audit log
    await client.from('audit_logs').insert({
      user_id: adminUser.id,
      user_email: adminUser.email,
      action: 'admin_delete',
      resource: userId,
      metadata: { deleted_email: authUser.email },
    })

    // 4. Delete the auth user — CASCADE removes profiles, requests etc via FK
    const { error: deleteErr } = await client.auth.admin.deleteUser(userId)
    if (deleteErr) throw deleteErr

    // 5. Email report via Brevo (sent after confirmed deletion to avoid false reports)
    const brevoKey = Deno.env.get('BREVO_API_KEY')
    if (brevoKey) {
      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'BliGlömd System', email: 'noreply@xn--bliglmd-e1a.se' },
          to: [{ email: ADMIN_EMAIL }],
          subject: `[Admin] Raderingsrapport — ${authUser.email}`,
          htmlContent: buildEmailHtml(snapshot as unknown as Record<string, unknown>),
        }),
      })
      if (!emailRes.ok) {
        console.error('Brevo email failed:', emailRes.status, await emailRes.text())
      }
    }

    return new Response(JSON.stringify({ success: true, deleted: authUser.email }), {
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...h, 'Content-Type': 'application/json' },
    })
  }
})
