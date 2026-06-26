export type UserLevel = 1 | 2 | 3

export type CompanyCategory =
  | 'Sociala medier'
  | 'Sökmotor'
  | 'Shopping'
  | 'Finans'
  | 'Streaming'
  | 'Nyheter'
  | 'Övrigt'

export interface Company {
  id: string
  name: string
  category: CompanyCategory
  country: string
  gdpr_email: string | null
  gdpr_url: string
  instructions_sv: string
  instructions_en: string
  level1_available: boolean
  level2_available: boolean
  /** L3 requires gdpr_email — never true when gdpr_email is null */
  level3_available: boolean
  /** Swedish publishing certificate (utgivningsbevis) under YGL */
  utgivningsbevis: boolean
}

export type RequestStatus = 'pending' | 'sent' | 'confirmed' | 'removed' | 'failed' | 'expired'

export interface Request {
  id: string
  user_id: string
  company_id: string
  company_name: string
  user_email: string
  user_name: string
  status: RequestStatus
  sent_at: string | null
  response_at: string | null
  notes: string | null
  created_at: string
}

export interface Scan {
  id: string
  user_id: string
  scan_email: string
  breach_names: string[]
  breach_count: number
  created_at: string
}
