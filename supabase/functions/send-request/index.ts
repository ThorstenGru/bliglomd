// Supabase Edge Function — skickar GDPR-mail via Resend
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { companyName, gdprEmail, userName, userEmail } = await req.json()

    const mailBody = `Hej,

Jag utövar min rätt enligt GDPR Artikel 17 (rätten till radering) och
begär att ni omgående raderar alla personuppgifter som ni behandlar
avseende mig.

Namn: ${userName}
E-postadress: ${userEmail}

Vänligen bekräfta skriftligen när raderingen är genomförd, senast inom
30 dagar i enlighet med GDPR Artikel 12.

Med vänliga hälsningar,
${userName}`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BliGlömd <noreply@bliglomd.se>',
        to: gdprEmail,
        reply_to: userEmail,
        subject: `Begäran om radering av personuppgifter – GDPR Artikel 17 (${companyName})`,
        text: mailBody,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
