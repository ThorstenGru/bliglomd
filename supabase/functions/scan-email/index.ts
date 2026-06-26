// Supabase Edge Function — HIBP-skärming
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
    const { email } = await req.json()
    const encodedEmail = encodeURIComponent(email)

    const hibpRes = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodedEmail}`,
      {
        headers: {
          'hibp-api-key': Deno.env.get('HIBP_API_KEY') ?? '',
          'User-Agent': 'BliGlomd-GDPR-Tool',
        },
      }
    )

    let breaches = []
    if (hibpRes.status === 200) {
      breaches = await hibpRes.json()
    }

    return new Response(JSON.stringify({ breaches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ breaches: [], error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
