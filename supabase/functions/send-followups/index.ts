// Scheduled daily via pg_cron. Closes the gap between what Cipher/Ghost
// advertise ("Spårning av svar" / "Automatisk uppföljning" / "Påminnelse vid
// utebliven respons") and what previously existed -- send-reminders only ever
// covered 5 hardcoded opt-out sites' 12-month BankID renewal, nothing about a
// regular GDPR Art. 17 request going unanswered for 30 days.
//
// Every request past 30 days with no response gets the user a nudge email.
// Ghost-tier requests (sent_via = 'ghost_auto') additionally get a real,
// automatic follow-up sent to the company itself, fulfilling Ghost's specific
// "we follow up for you" promise -- Cipher only ever gets the user notified,
// since BliGlömd never had authority to act on the company side for Cipher.
// Each request is escalated exactly once (escalated_at is set immediately after).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  // Fails closed: a missing secret rejects every request instead of allowing them.
  const secret = Deno.env.get('FOLLOWUPS_SECRET')
  const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!secret || auth !== secret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const brevoKey = Deno.env.get('BREVO_API_KEY')
  if (!supabaseUrl || !serviceKey || !brevoKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()

  const { data: pending, error: fetchError } = await supabase
    .from('requests')
    .select('id, user_email, user_name, company_name, company_gdpr_email, sent_via, sent_at')
    .eq('status', 'sent')
    .eq('request_type', 'gdpr_art17')
    .is('response_at', null)
    .is('escalated_at', null)
    .lt('sent_at', cutoff)

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }

  let userNudges = 0
  let companyFollowups = 0
  const errors: string[] = []

  async function sendMail(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey!, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) errors.push(`${res.status}: ${await res.text()}`)
    return res.ok
  }

  for (const r of pending ?? []) {
    const sentDate = r.sent_at ? new Date(r.sent_at).toISOString().slice(0, 10) : 'okänt datum'

    const nudgeOk = await sendMail({
      sender: { name: 'BliGlömd', email: 'noreply@xn--bliglmd-e1a.se' },
      to: [{ email: r.user_email }],
      subject: `Inget svar än från ${r.company_name}`,
      textContent: [
        `Hej ${r.user_name},`,
        '',
        `Det har gått 30 dagar sedan din GDPR-begäran skickades till ${r.company_name} (${sentDate}), utan svar.`,
        '',
        r.sent_via === 'ghost_auto'
          ? 'BliGlömd har nu automatiskt skickat en uppföljning till företaget åt dig.'
          : 'Du kan behöva skicka en påminnelse till företaget själv. Om det dröjer längre kan du överväga att anmäla ärendet till Integritetsskyddsmyndigheten (IMY).',
        '',
        'Logga in på bliglömd.se för att se status på dina förfrågningar.',
        '',
        '– BliGlömd',
      ].join('\n'),
    })
    if (nudgeOk) userNudges++

    if (r.sent_via === 'ghost_auto' && r.company_gdpr_email) {
      const followupOk = await sendMail({
        sender: { name: `${r.user_name} via BliGlömd`, email: 'noreply@xn--bliglmd-e1a.se' },
        to: [{ email: r.company_gdpr_email }],
        replyTo: { email: r.user_email, name: r.user_name },
        subject: `Uppföljning: Begäran om radering av personuppgifter – GDPR Artikel 17`,
        textContent: [
          'Hej,',
          '',
          `Detta är en uppföljning av min begäran om radering av personuppgifter enligt GDPR Artikel 17, ursprungligen skickad ${sentDate}.`,
          '',
          'Jag har ännu inte fått någon bekräftelse och ber er vänligen behandla ärendet och återkomma inom de 30 dagar som anges i GDPR Artikel 12.',
          '',
          `Namn: ${r.user_name}`,
          `E-postadress: ${r.user_email}`,
          '',
          'Med vänliga hälsningar,',
          r.user_name,
        ].join('\n'),
      })
      if (followupOk) companyFollowups++
    }

    await supabase.from('requests').update({ escalated_at: new Date().toISOString() }).eq('id', r.id)
  }

  return new Response(
    JSON.stringify({ ok: true, checked: pending?.length ?? 0, user_nudges: userNudges, company_followups: companyFollowups, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
