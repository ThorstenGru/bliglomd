// Supabase Edge Function — breach check via XposedOrNot (free, no API key needed)
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

    const xonRes = await fetch(
      `https://api.xposedornot.com/v1/breach-analytics?email=${encodedEmail}`,
      { headers: { 'User-Agent': 'BliGlomd-GDPR-Tool' } }
    )

    let breaches = []
    if (xonRes.status === 200) {
      const data = await xonRes.json()
      breaches = data?.ExposedBreaches?.breaches_details ?? []
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
