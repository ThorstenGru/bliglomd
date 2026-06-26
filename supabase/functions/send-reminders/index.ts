// Scheduled daily at 09:00 UTC via Supabase cron (configure in dashboard).
// Finds opt-out requests whose protection is about to expire and sends reminder emails.
//
// Currently handles: Ratsit (12-month protection window)
// Sends reminder 30 days before expiry (at 11 months), then marks status = 'expired'.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REMINDER_COMPANIES: Record<string, { reminderMonths: number; nameSv: string }> = {
  ratsit: { reminderMonths: 11, nameSv: 'Ratsit' },
}

serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey   = Deno.env.get('RESEND_API_KEY')

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let totalSent = 0
  const errors: string[] = []

  for (const [companyId, { reminderMonths, nameSv }] of Object.entries(REMINDER_COMPANIES)) {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - reminderMonths)

    const { data: requests, error: fetchError } = await supabase
      .from('requests')
      .select('id, user_email, user_name, sent_at')
      .eq('company_id', companyId)
      .eq('status', 'sent')
      .lt('sent_at', cutoff.toISOString())

    if (fetchError) {
      errors.push(`fetch ${companyId}: ${fetchError.message}`)
      continue
    }

    for (const req of (requests ?? [])) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'BliGlömd <noreply@bliglomd.se>',
          to: req.user_email,
          subject: `Påminnelse: Ditt ${nameSv}-skydd löper snart ut`,
          text: [
            `Hej ${req.user_name},`,
            '',
            `Ditt dataskydd på ${nameSv} löper ut om ungefär en månad.`,
            '',
            `Kom ihåg att förnya skyddet på ${nameSv}.se via BankID — annars visas dina uppgifter igen.`,
            '',
            'Logga in på bliglomd.se för att se status på dina förfrågningar.',
            '',
            '– BliGlömd',
          ].join('\n'),
        }),
      })

      if (res.ok) {
        await supabase
          .from('requests')
          .update({ status: 'expired' })
          .eq('id', req.id)
        totalSent++
      } else {
        const body = await res.text()
        errors.push(`resend ${req.id}: ${res.status} ${body}`)
      }
    }
  }

  return new Response(
    JSON.stringify({ reminders_sent: totalSent, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
