// Scheduled daily at 09:00 UTC via Supabase cron (configure in dashboard).
// Finds opt-out requests whose protection is about to expire and sends reminder emails.
//
// Two separate passes, 1 month apart, so the "expires in about a month" email and the
// dashboard's "expired" status never contradict each other and no request is left
// permanently stuck at a status the true 12-month lapse hasn't actually reached yet:
//   - at 11 months: send the "renew soon" email, stamp bankid_reminder_sent_at (status
//     stays 'sent' — this used to jump straight to 'expired' here, a month early)
//   - at 12 months: flip status to 'expired' for real (no email already sent up to this
//     point would need not have been sent, but is a plain follow-up nudge otherwise).
// MrKoll is intentionally excluded: its own listing states BankID/renewal isn't required
// for that site, unlike the other four, so it never had a real 12-month window to expire.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REMINDER_COMPANIES: Record<string, { nameSv: string }> = {
  ratsit:      { nameSv: 'Ratsit' },
  merinfo:     { nameSv: 'Merinfo' },
  hitta:       { nameSv: 'Hitta.se' },
  birthday:    { nameSv: 'Birthday.se' },
}

const REMINDER_AT_MONTHS = 11
const EXPIRE_AT_MONTHS = 12

Deno.serve(async (req) => {
  // Fails closed: a missing secret rejects every request instead of allowing them.
  const remindersSecret = Deno.env.get('REMINDERS_SECRET')
  const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!remindersSecret || auth !== remindersSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const brevoKey    = Deno.env.get('BREVO_API_KEY')

  if (!supabaseUrl || !serviceKey || !brevoKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let remindersSent = 0
  let expired = 0
  const errors: string[] = []

  const reminderCutoff = new Date()
  reminderCutoff.setMonth(reminderCutoff.getMonth() - REMINDER_AT_MONTHS)
  const expireCutoff = new Date()
  expireCutoff.setMonth(expireCutoff.getMonth() - EXPIRE_AT_MONTHS)

  for (const [companyId, { nameSv }] of Object.entries(REMINDER_COMPANIES)) {
    // Pass 1: 11-month "renews soon" nudge — only once per request (bankid_reminder_sent_at
    // gates it), and never touches status, so the dashboard doesn't say "expired" a month early.
    const { data: dueForReminder, error: reminderFetchError } = await supabase
      .from('requests')
      .select('id, user_id, user_email, user_name, sent_at')
      .eq('company_id', companyId)
      .eq('status', 'sent')
      .is('bankid_reminder_sent_at', null)
      .lt('sent_at', reminderCutoff.toISOString())

    if (reminderFetchError) {
      errors.push(`fetch reminder ${companyId}: ${reminderFetchError.message}`)
    } else {
      // Tracking ("I did this myself") is open to any tier, since BliGlömd can't do the
      // BankID step for anyone regardless of plan -- but the auto-reminder email stays a
      // Ghost perk, checked against the user's CURRENT level (not whatever it was when
      // they clicked the button), so an upgrade/downgrade takes effect immediately.
      const candidates = dueForReminder ?? []
      const userIds = [...new Set(candidates.map(r => r.user_id))]
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, level').in('id', userIds)
        : { data: [] as { id: string; level: number }[] }
      const ghostUserIds = new Set((profiles ?? []).filter(p => p.level >= 3).map(p => p.id))

      for (const r of candidates.filter(r => ghostUserIds.has(r.user_id))) {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'BliGlömd', email: 'noreply@xn--bliglmd-e1a.se' },
            to: [{ email: r.user_email }],
            subject: `Påminnelse: Ditt ${nameSv}-skydd löper snart ut`,
            textContent: [
              `Hej ${r.user_name},`,
              '',
              `Ditt dataskydd på ${nameSv} löper ut om ungefär en månad.`,
              '',
              `Kom ihåg att förnya skyddet på ${nameSv}.se via BankID — annars visas dina uppgifter igen.`,
              '',
              'Logga in på bliglömd.se för att se status på dina förfrågningar.',
              '',
              '– BliGlömd',
            ].join('\n'),
          }),
        })

        if (res.ok) {
          await supabase.from('requests').update({ bankid_reminder_sent_at: new Date().toISOString() }).eq('id', r.id)
          remindersSent++
        } else {
          errors.push(`brevo reminder ${r.id}: ${res.status} ${await res.text()}`)
        }
      }
    }

    // Pass 2: the real 12-month lapse — flip status to 'expired' for real, independent of
    // whether the reminder email above happened to succeed.
    const { data: expiredIds, error: expireError } = await supabase
      .from('requests')
      .update({ status: 'expired' })
      .eq('company_id', companyId)
      .eq('status', 'sent')
      .lt('sent_at', expireCutoff.toISOString())
      .select('id')

    if (expireError) {
      errors.push(`expire ${companyId}: ${expireError.message}`)
    } else {
      expired += expiredIds?.length ?? 0
    }
  }

  return new Response(
    JSON.stringify({ reminders_sent: remindersSent, expired, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
