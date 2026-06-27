import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  throw new Error(
    'VITE_SUPABASE_URL is missing or invalid. ' +
    'Set it in .env.local for local dev or in GitHub Secrets for CI.'
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is missing. ' +
    'Set it in .env.local for local dev or in GitHub Secrets for CI.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})
