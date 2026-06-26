export type UserLevel = 1 | 2 | 3

export interface Company {
  id: string
  name: string
  category: 'Sociala medier' | 'Sökmotor' | 'Shopping' | 'Finans' | 'Streaming' | 'Nyheter' | 'Övrigt'
  country: string
  gdpr_email: string | null
  gdpr_url: string
  instructions_sv: string
  level1_available: boolean
  level2_available: boolean
  level3_available: boolean
}

export interface Request {
  id: string
  user_id: string
  company_id: string
  company_name: string
  user_email: string
  user_name: string
  status: 'pending' | 'sent' | 'confirmed' | 'removed' | 'failed' | 'expired'
  sent_at: string | null
  response_at: string | null
  notes: string | null
  created_at: string
}

export interface Scan {
  id: string
  user_id: string
  scan_email: string
  hibp_breaches: string[]
  category_suggestions: Company[]
  created_at: string
}
