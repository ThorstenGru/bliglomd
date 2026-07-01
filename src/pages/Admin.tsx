import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@xn--bliglmd-e1a.se'

interface AdminUser {
  id: string
  email: string
  full_name: string
  level: 1 | 2 | 3
  created_at: string
  last_sign_in_at: string | null
  requests: number
  scans: number
  subscription_status: 'inactive' | 'active' | 'past_due' | 'canceled'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

interface AuditEvent {
  id: string
  user_email: string | null
  action: string
  resource: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface DeletionRecord {
  id: string
  deleted_user_email: string
  deleted_by_email: string
  created_at: string
  snapshot?: Record<string, unknown>
}

interface UserRequest {
  id: string
  company_name: string
  status: string
  sent_at: string | null
  response_at: string | null
  created_at: string
}

interface UserScan {
  id: string
  scan_email: string
  breach_names: string[]
  breach_count: number
  created_at: string
}

interface ConsentRow {
  id: string
  user_id: string
  user_email: string
  consented_at: string
  terms_version: string
  consent_text: string
  price_id?: string
  consent_context?: string
  privacy_version?: string
}

interface UserDetail {
  profile: Record<string, unknown> | null
  requests: UserRequest[]
  scans: UserScan[]
  checkout_consents: ConsentRow[]
  signup_consent: ConsentRow[]
}

interface StaleRequest {
  id: string
  user_email: string
  company_name: string
  status: string
  created_at: string
}

interface CompanyTrend {
  company_name: string
  cnt_this_week: number
  cnt_last_week: number
  cnt_all_time: number
}

interface AdminStats {
  snapshot: {
    dau: number; wau: number; mau: number
    retention_pct: number; total_users: number
    signups_this_week: number; signups_last_week: number
    reqs_this_week: number; reqs_last_week: number
    active_reqs: number; stale_reqs: number
    avg_reqs_per_user: number
    breach_rate_pct: number; total_breaches: number; avg_breaches: number
    mrr_sek: number
    revenue_by_tier: Record<number, { active: number; mrr: number }>
  }
  signups_per_day: { day: string; cnt: number }[]
  reqs_per_day: { day: string; cnt: number }[]
  scans_per_day: { day: string; cnt: number }[]
  top_companies: { company_name: string; cnt: number }[]
  request_statuses: { status: string; cnt: number }[]
  response_times: { company_name: string; avg_days: number; total_confirmed: number }[]
  stale_requests: StaleRequest[]
  company_trends: CompanyTrend[]
  generated_at: string
}

type Tab = 'overview' | 'users' | 'audit' | 'analytics' | 'consents'

// ── Helpers ───────────────────────────────────────────────────────────────────

const LVL_LABEL: Record<1 | 2 | 3, string> = { 1: 'L1 Gratis', 2: 'L2 Plus', 3: 'L3 Pro' }
const LVL_BG:    Record<1 | 2 | 3, string> = { 1: '#DCFCE7', 2: '#DBEAFE', 3: '#F3E8FF' }
const LVL_FG:    Record<1 | 2 | 3, string> = { 1: '#15803D', 2: '#1D4ED8', 3: '#6B21A8' }

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtTimer(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── ActionBadge ───────────────────────────────────────────────────────────────

const ACTION_MAP: Record<string, { bg: string; fg: string; label: string }> = {
  admin_level_change: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Nivåändring' },
  admin_delete:       { bg: '#FEE2E2', fg: '#DC2626', label: 'Radering' },
  admin_export:       { bg: '#FEF9C3', fg: '#92400E', label: 'Export' },
  admin_login:        { bg: '#E0E7FF', fg: '#4338CA', label: 'Admininloggning' },
  scan_email:         { bg: '#D1FAE5', fg: '#15803D', label: 'Skanning' },
  send_request:       { bg: '#F3E8FF', fg: '#6B21A8', label: 'Förfrågan' },
}

const AUDIT_ACTIONS = ['admin_level_change', 'admin_delete', 'admin_export', 'admin_login', 'scan_email', 'send_request']

function ActionBadge({ action }: { action: string }) {
  const s = ACTION_MAP[action] ?? { bg: '#F1F5F9', fg: '#64748B', label: action }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.fg, background: s.bg, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── SidebarIcon ───────────────────────────────────────────────────────────────

const ICONS: Record<Tab, string> = {
  overview:  'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3h2v-2h-2v-2h-2v2h-2v2h2v2h2zm4 2h2v-2h-2z',
  users:     'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
  audit:     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',
  analytics: 'M18 20V10M12 20V4M6 20v-6',
  consents:  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
}

const TAB_LABELS: Record<Tab, string> = {
  overview:  'Översikt',
  users:     'Användare',
  audit:     'Granskningslogg',
  analytics: 'Statistik',
  consents:  'Samtycke',
}

const SUB_STATUS_LABEL: Record<AdminUser['subscription_status'], string> = {
  inactive: 'Ingen',
  active: 'Aktiv',
  past_due: 'Försenad',
  canceled: 'Avslutad',
}
const SUB_STATUS_BG: Record<AdminUser['subscription_status'], string> = {
  inactive: '#F1F5F9', active: '#DCFCE7', past_due: '#FEF9C3', canceled: '#FEE2E2',
}
const SUB_STATUS_FG: Record<AdminUser['subscription_status'], string> = {
  inactive: '#64748B', active: '#15803D', past_due: '#92400E', canceled: '#DC2626',
}

function SubBadge({ status }: { status: AdminUser['subscription_status'] }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: SUB_STATUS_FG[status], background: SUB_STATUS_BG[status], borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      {SUB_STATUS_LABEL[status]}
    </span>
  )
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Analytics chart components ────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '16px 18px' }}>
      <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#94A3B8', margin: '3px 0 0' }}>{sub}</p>}
    </div>
  )
}

function BarChart({ data, color, label }: { data: { day: string; cnt: number }[]; color: string; label: string }) {
  const max = Math.max(...data.map(d => d.cnt), 1)
  const W = 420, H = 80
  const n = data.length || 1
  const bw = Math.max(2, Math.floor(W / n) - 1)
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      {data.length === 0
        ? <p style={{ fontSize: 12, color: '#CBD5E1' }}>Ingen data ännu</p>
        : <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: '100%', overflow: 'visible', display: 'block' }}>
            {data.map((d, i) => {
              const h = Math.max(2, Math.round((d.cnt / max) * H))
              const x = Math.round(i * (W / n))
              return (
                <g key={d.day}>
                  <rect x={x} y={H - h} width={bw} height={h} fill={color} rx={2} opacity={0.8} />
                  {d.cnt > 0 && h > 16 && (
                    <text x={x + bw / 2} y={H - h + 10} textAnchor="middle" fontSize={8} fill="white" fontWeight="700">{d.cnt}</text>
                  )}
                </g>
              )
            })}
            {data.length > 0 && [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => (
              <text key={i} x={Math.round(i * (W / n)) + bw / 2} y={H + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">{data[i]?.day.slice(5)}</text>
            ))}
          </svg>
      }
    </div>
  )
}

function HorizBars({ items, color }: { items: { company_name: string; cnt: number }[]; color: string }) {
  const max = Math.max(...items.map(i => i.cnt), 1)
  return (
    <div>
      {items.length === 0
        ? <p style={{ fontSize: 12, color: '#CBD5E1' }}>Inga förfrågningar ännu</p>
        : items.map(item => (
          <div key={item.company_name} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{item.company_name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{item.cnt}</span>
            </div>
            <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(item.cnt / max * 100)}%`, background: color, borderRadius: 3 }} />
            </div>
          </div>
        ))}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  pending:   '#F59E0B',
  sent:      '#3B82F6',
  confirmed: '#10B981',
  rejected:  '#EF4444',
  expired:   '#94A3B8',
}

function StatusBars({ data }: { data: { status: string; cnt: number }[] }) {
  const total = data.reduce((s, d) => s + d.cnt, 0)
  if (total === 0) return <p style={{ fontSize: 12, color: '#CBD5E1' }}>Inga förfrågningar ännu</p>
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
        {data.map(d => (
          <div key={d.status} style={{ width: `${d.cnt / total * 100}%`, background: STATUS_COLORS[d.status] ?? '#CBD5E1' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map(d => (
          <div key={d.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[d.status] ?? '#CBD5E1', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#64748B' }}>{d.status}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{d.cnt}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function Admin() {
  const navigate = useNavigate()
  const [ready, setReady]           = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [tab, setTab]               = useState<Tab>('overview')
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [audit, setAudit]           = useState<AuditEvent[]>([])
  const [deletions, setDeletions]   = useState<DeletionRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<AdminUser | null>(null)
  const [busyUser, setBusyUser]     = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [lvlFilter, setLvlFilter]   = useState<'' | '1' | '2' | '3'>('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [timer, setTimer]           = useState(30 * 60)
  const [notice, setNotice]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [stats, setStats]           = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [subFilter, setSubFilter]   = useState<'' | AdminUser['subscription_status']>('')
  const [detail, setDetail]         = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [checkoutConsents, setCheckoutConsents] = useState<ConsentRow[]>([])
  const [signupConsents, setSignupConsents]     = useState<ConsentRow[]>([])
  const [consentsLoading, setConsentsLoading]   = useState(false)
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [auditSearch, setAuditSearch]             = useState('')
  const [snapshotView, setSnapshotView]           = useState<DeletionRecord | null>(null)
  const [showStale, setShowStale]                 = useState(false)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    const { data, error } = await supabase.functions.invoke('admin-stats')
    if (!error && data) setStats(data as AdminStats)
    setStatsLoading(false)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [usersRes, auditRes, deletionsRes] = await Promise.all([
      supabase.functions.invoke('admin-list-users'),
      supabase
        .from('audit_logs')
        .select('id, user_email, action, resource, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('admin_deletions')
        .select('id, deleted_user_email, deleted_by_email, created_at, snapshot')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (!usersRes.error) setUsers(usersRes.data?.users ?? [])
    if (!auditRes.error)  setAudit(auditRes.data ?? [])
    if (!deletionsRes.error) setDeletions(deletionsRes.data ?? [])
    setLoading(false)
  }, [])

  const loadConsents = useCallback(async () => {
    setConsentsLoading(true)
    const { data, error } = await supabase.functions.invoke('admin-consents')
    if (!error && data) {
      setCheckoutConsents(data.checkout_consents ?? [])
      setSignupConsents(data.signup_consents ?? [])
    }
    setConsentsLoading(false)
  }, [])

  const loadUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true)
    setDetail(null)
    const { data, error } = await supabase.functions.invoke('admin-export-user', { body: { userId } })
    if (!error && data) {
      setDetail({
        profile: data.profile ?? null,
        requests: data.requests ?? [],
        scans: data.scans ?? [],
        checkout_consents: data.checkout_consents ?? [],
        signup_consent: data.signup_consent ?? [],
      })
    }
    setDetailLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      // user_metadata is self-editable by any logged-in user — role alone is
      // not a safe boundary. The exact admin email is the real check.
      if (!user || user.user_metadata?.role !== 'admin' || user.email !== ADMIN_EMAIL) {
        navigate('/', { replace: true })
        return
      }
      setAdminEmail(user.email ?? '')
      setReady(true)
      loadAll()
      loadConsents()
      // Admin actions are audited, but admin logins never were — close that gap.
      supabase.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'admin_login',
        resource: null,
        metadata: { user_agent: navigator.userAgent },
      })
    })
  }, [navigate, loadAll, loadConsents])

  useEffect(() => {
    if (selected) loadUserDetail(selected.id)
    else setDetail(null)
  }, [selected, loadUserDetail])

  useEffect(() => {
    if (!ready) return
    loadStats()
    const t = setInterval(loadStats, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [ready, loadStats])

  useEffect(() => {
    if (!ready) return
    const t = setInterval(() => setTimer(s => {
      if (s <= 1) {
        supabase.auth.signOut()
        navigate('/', { replace: true })
        return 0
      }
      return s - 1
    }), 1000)
    return () => clearInterval(t)
  }, [ready, navigate])

  function showNotice(type: 'ok' | 'err', msg: string) {
    clearTimeout(noticeTimerRef.current)
    setNotice({ type, msg })
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000)
  }

  async function handleLevelChange(userId: string, newLevel: 1 | 2 | 3) {
    setBusyUser(userId)
    const { error } = await supabase.functions.invoke('admin-update-user', {
      body: { userId, level: newLevel },
    })
    if (error) {
      showNotice('err', 'Kunde inte ändra nivå')
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, level: newLevel } : u))
      if (selected?.id === userId) setSelected(prev => prev ? { ...prev, level: newLevel } : null)
      showNotice('ok', `Nivå ändrad till ${LVL_LABEL[newLevel]}`)
    }
    setBusyUser(null)
  }

  async function handleExport(userId: string) {
    setExporting(true)
    const { data, error } = await supabase.functions.invoke('admin-export-user', {
      body: { userId },
    })
    setExporting(false)
    if (error) { showNotice('err', 'Export misslyckades'); return }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bliglomd-export-${userId.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showNotice('ok', 'Export nedladdad')
  }

  async function handleDelete() {
    if (!selected || deleteInput !== selected.email) return
    setDeleting(true)
    const { error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId: selected.id },
    })
    setDeleting(false)
    if (error) { showNotice('err', 'Radering misslyckades'); return }
    const email = selected.email
    setUsers(prev => prev.filter(u => u.id !== selected.id))
    setSelected(null)
    setShowDelete(false)
    setDeleteInput('')
    showNotice('ok', `${email} raderades — rapport skickad till dig`)
    loadAll()
  }

  const { lvlCounts, totalReqs, totalScans } = useMemo(() => {
    const lvlCounts = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>
    users.forEach(u => { if (u.level >= 1 && u.level <= 3) lvlCounts[u.level as 1 | 2 | 3]++ })
    return {
      lvlCounts,
      totalReqs:  users.reduce((s, u) => s + u.requests, 0),
      totalScans: users.reduce((s, u) => s + u.scans, 0),
    }
  }, [users])

  const filtered = useMemo(() =>
    users.filter(u => {
      const q = search.toLowerCase()
      const matchSearch = !q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q)
      const matchLvl = !lvlFilter || u.level === Number(lvlFilter)
      const matchSub = !subFilter || u.subscription_status === subFilter
      return matchSearch && matchLvl && matchSub
    }),
  [users, search, lvlFilter, subFilter])

  const filteredAudit = useMemo(() =>
    audit.filter(e => {
      const q = auditSearch.toLowerCase()
      const matchSearch = !q || (e.user_email ?? '').toLowerCase().includes(q)
      const matchAction = !auditActionFilter || e.action === auditActionFilter
      return matchSearch && matchAction
    }),
  [audit, auditSearch, auditActionFilter])

  if (!ready) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '"Inter", -apple-system, system-ui, sans-serif', fontSize: 14, background: '#EEF2F8' }}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <nav style={{ width: 220, flexShrink: 0, background: '#0F172A', display: 'flex', flexDirection: 'column', padding: '0 0 16px' }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="18" viewBox="0 0 40 40" fill="white" aria-hidden="true">
                <path d="M20 3L6 9V19C6 28 12.5 35 20 38C27.5 35 34 28 34 19V9L20 3Z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.15 }}>BliGlömd</p>
              <p style={{ fontSize: 10, color: '#475569', margin: 0, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Admin</p>
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ padding: '6px 10px', flex: 1 }}>
          {(['overview', 'users', 'audit', 'analytics', 'consents'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2,
                background: tab === t ? '#1E293B' : 'transparent',
                color: tab === t ? 'white' : '#64748B',
                fontWeight: tab === t ? 600 : 400,
                fontSize: 13,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS[t]} />
              </svg>
              {TAB_LABELS[t]}
              {t === 'users' && users.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#1E3A8A', color: '#93C5FD', borderRadius: 20, padding: '1px 7px' }}>
                  {users.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Admin info + timer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminEmail}</p>
              <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>Superadmin</p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#475569' }}>Session</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: timer < 300 ? '#EF4444' : '#475569', fontVariantNumeric: 'tabular-nums' }}>
              {fmtTimer(timer)}
            </span>
          </div>
        </div>
      </nav>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.025em' }}>
            {TAB_LABELS[tab]}
          </h1>
          <button
            onClick={() => { loadAll(); if (tab === 'analytics') loadStats(); if (tab === 'consents') loadConsents() }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Uppdatera
          </button>
        </div>

        {/* Notice */}
        {notice && (
          <div style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: notice.type === 'ok' ? '#DCFCE7' : '#FEE2E2',
            color:      notice.type === 'ok' ? '#15803D'  : '#DC2626',
          }}>
            {notice.msg}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94A3B8' }}>
            Laddar...
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ─────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div>
                {/* Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                  {[
                    { label: 'Totalt användare',     value: users.length,    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z', color: '#2563EB' },
                    { label: 'Förfrågningar totalt', value: totalReqs,       icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',         color: '#7C3AED' },
                    { label: 'Skanningar totalt',    value: totalScans,      icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: '#0891B2' },
                    { label: 'Raderingsrapporter',   value: deletions.length, icon: 'M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2',                                     color: '#DC2626' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d={s.icon} />
                          </svg>
                        </div>
                        <span style={{ fontSize: 11, color: '#64748B' }}>{s.label}</span>
                      </div>
                      <p style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.035em', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {s.value.toLocaleString('sv-SE')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Revenue */}
                {stats && (
                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '0 0 14px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Intäkter (MRR, uppskattat)
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 8 }}>
                      <div style={{ borderRadius: 10, border: '1.5px solid #DCFCE7', padding: '14px 16px', background: '#F0FDF4' }}>
                        <p style={{ fontSize: 11, color: '#15803D', fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase' }}>Totalt MRR</p>
                        <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                          {stats.snapshot.mrr_sek.toLocaleString('sv-SE')} kr
                        </p>
                      </div>
                      <div style={{ borderRadius: 10, border: `1.5px solid ${LVL_BG[2]}`, padding: '14px 16px', background: LVL_BG[2] + '55' }}>
                        <p style={{ fontSize: 11, color: LVL_FG[2], fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase' }}>Cipher</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {(stats.snapshot.revenue_by_tier[2]?.mrr ?? 0).toLocaleString('sv-SE')} kr
                        </p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{stats.snapshot.revenue_by_tier[2]?.active ?? 0} aktiva</p>
                      </div>
                      <div style={{ borderRadius: 10, border: `1.5px solid ${LVL_BG[3]}`, padding: '14px 16px', background: LVL_BG[3] + '55' }}>
                        <p style={{ fontSize: 11, color: LVL_FG[3], fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase' }}>Ghost</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {(stats.snapshot.revenue_by_tier[3]?.mrr ?? 0).toLocaleString('sv-SE')} kr
                        </p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{stats.snapshot.revenue_by_tier[3]?.active ?? 0} aktiva</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: '#CBD5E1', margin: 0 }}>
                      Uppskattning baserad på månadspris per nivå — särskiljer inte månads- och årsabonnemang.
                    </p>
                  </div>
                )}

                {/* Level breakdown */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 16 }}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '0 0 14px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Fördelning per nivå
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {([1, 2, 3] as const).map(lvl => (
                      <div key={lvl} style={{ borderRadius: 10, border: `1.5px solid ${LVL_BG[lvl]}`, padding: '14px 16px', background: LVL_BG[lvl] + '55' }}>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: LVL_FG[lvl], background: LVL_BG[lvl], borderRadius: 20, padding: '2px 10px', marginBottom: 8 }}>
                          {LVL_LABEL[lvl]}
                        </span>
                        <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                          {lvlCounts[lvl]}
                        </p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                          {users.length > 0 ? Math.round(lvlCounts[lvl] / users.length * 100) : 0}% av alla
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent deletions */}
                {deletions.length > 0 && (
                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '20px 24px' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '0 0 14px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Senaste raderingar
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          {['Användare', 'Raderades av', 'Tidpunkt', ''].map(col => (
                            <th key={col} style={{ textAlign: col === '' ? 'right' : 'left', padding: '0 0 8px', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11 }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deletions.slice(0, 5).map(d => (
                          <tr key={d.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                            <td style={{ padding: '8px 0', color: '#374151' }}>{d.deleted_user_email}</td>
                            <td style={{ padding: '8px 0', color: '#64748B' }}>{d.deleted_by_email}</td>
                            <td style={{ padding: '8px 0', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(d.created_at)}</td>
                            <td style={{ padding: '8px 0', textAlign: 'right' }}>
                              <button
                                onClick={() => setSnapshotView(d)}
                                style={{ padding: '3px 10px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                              >
                                Visa data
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── USERS TAB ─────────────────────────────────────────────── */}
            {tab === 'users' && (
              <div>
                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <input
                      type="search"
                      placeholder="Sök e-post eller namn…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                    />
                  </div>
                  <select
                    value={lvlFilter}
                    onChange={e => setLvlFilter(e.target.value as '' | '1' | '2' | '3')}
                    style={{ padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#374151', background: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Alla nivåer</option>
                    <option value="1">L1 Gratis</option>
                    <option value="2">L2 Plus</option>
                    <option value="3">L3 Pro</option>
                  </select>
                  <select
                    value={subFilter}
                    onChange={e => setSubFilter(e.target.value as typeof subFilter)}
                    style={{ padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#374151', background: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Alla betalstatus</option>
                    <option value="active">Aktiv</option>
                    <option value="past_due">Försenad</option>
                    <option value="canceled">Avslutad</option>
                    <option value="inactive">Ingen</option>
                  </select>
                  <button
                    onClick={() => downloadCsv('bliglomd-anvandare.csv', filtered as unknown as Record<string, unknown>[])}
                    style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}
                  >
                    Exportera CSV
                  </button>
                </div>

                {/* Table */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ background: '#F8FAFC' }}>
                        <tr>
                          {['E-post', 'Namn', 'Nivå', 'Betalning', 'Förfrågn.', 'Skann.', 'Registrerad', 'Senast aktiv', ''].map(col => (
                            <th key={col} style={{ padding: '10px 14px', textAlign: col === '' ? 'right' : 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((u, i) => (
                          <tr
                            key={u.id}
                            style={{ borderTop: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC', cursor: 'pointer' }}
                            onClick={() => setSelected(u)}
                            onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC')}
                          >
                            <td style={{ padding: '11px 14px', color: '#1E293B', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                            <td style={{ padding: '11px 14px', color: '#475569', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || '—'}</td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: LVL_FG[u.level], background: LVL_BG[u.level], borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>
                                {LVL_LABEL[u.level]}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}><SubBadge status={u.subscription_status} /></td>
                            <td style={{ padding: '11px 14px', color: '#64748B', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{u.requests}</td>
                            <td style={{ padding: '11px 14px', color: '#64748B', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{u.scans}</td>
                            <td style={{ padding: '11px 14px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                            <td style={{ padding: '11px 14px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : 'Aldrig'}</td>
                            <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                              <button
                                onClick={e => { e.stopPropagation(); setSelected(u) }}
                                style={{ padding: '5px 12px', background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                              >
                                Visa
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                              Inga användare hittades
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── ANALYTICS TAB ─────────────────────────────────────────── */}
            {tab === 'analytics' && (
              <div>
                {statsLoading && !stats && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94A3B8' }}>
                    Laddar statistik...
                  </div>
                )}
                {stats && (
                  <>
                    {stats.snapshot.stale_reqs > 0 && (
                      <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 10, padding: '11px 16px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><span style={{ fontWeight: 700 }}>⚠️ {stats.snapshot.stale_reqs} ärenden</span> har inte fått svar på 30+ dagar</span>
                          <button
                            onClick={() => setShowStale(s => !s)}
                            style={{ padding: '4px 12px', background: 'white', border: '1px solid #FDE68A', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#92400E' }}
                          >
                            {showStale ? 'Dölj lista' : 'Visa lista'}
                          </button>
                        </div>
                        {showStale && (
                          <div style={{ marginTop: 10, maxHeight: 220, overflow: 'auto', background: 'white', borderRadius: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  {['Kund', 'Tjänst', 'Status', 'Skapad'].map(col => (
                                    <th key={col} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 10, textTransform: 'uppercase' }}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {stats.stale_requests.map(r => (
                                  <tr key={r.id} style={{ borderTop: '1px solid #F8FAFC' }}>
                                    <td style={{ padding: '6px 10px', color: '#374151' }}>{r.user_email}</td>
                                    <td style={{ padding: '6px 10px', color: '#374151' }}>{r.company_name}</td>
                                    <td style={{ padding: '6px 10px', color: STATUS_COLORS[r.status] ?? '#64748B', fontWeight: 600 }}>{r.status}</td>
                                    <td style={{ padding: '6px 10px', color: '#94A3B8' }}>{fmtDate(r.created_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Användare</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                      <KpiCard label="Totalt registrerade" value={stats.snapshot.total_users} />
                      <KpiCard label="Aktiva 30 dagar (MAU)" value={stats.snapshot.mau} sub={`WAU ${stats.snapshot.wau} · DAU ${stats.snapshot.dau}`} />
                      <KpiCard label="Retention WAU/MAU" value={`${stats.snapshot.retention_pct}%`} />
                      <KpiCard label="Nya denna vecka" value={stats.snapshot.signups_this_week} sub={`Förra veckan: ${stats.snapshot.signups_last_week}`} />
                    </div>

                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Förfrågningar</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                      <KpiCard label="Skickade denna vecka" value={stats.snapshot.reqs_this_week} sub={`Förra veckan: ${stats.snapshot.reqs_last_week}`} />
                      <KpiCard label="Aktiva ärenden" value={stats.snapshot.active_reqs} />
                      <KpiCard label="Snitt per användare" value={stats.snapshot.avg_reqs_per_user} />
                      <KpiCard label="Intrångsfrekvens" value={`${stats.snapshot.breach_rate_pct}%`} sub={`${stats.snapshot.total_breaches} funna · snitt ${stats.snapshot.avg_breaches}/skanning`} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                      <BarChart data={stats.signups_per_day} color="#2563EB" label="Registreringar per dag (30 dgr)" />
                      <BarChart data={stats.reqs_per_day} color="#7C3AED" label="Förfrågningar per dag (30 dgr)" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Topp tjänster (alla tider)</p>
                        <HorizBars items={stats.top_companies.slice(0, 8)} color="#2563EB" />
                      </div>
                      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ärendestatus</p>
                        <StatusBars data={stats.request_statuses} />
                      </div>
                    </div>

                    {stats.response_times.length > 0 && (
                      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Snabbast svarande tjänster (min 2 bekräftade)</p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                              {['Tjänst', 'Snitt (dagar)', 'Bekräftade'].map(col => (
                                <th key={col} style={{ padding: '0 0 8px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stats.response_times.map((r, i) => (
                              <tr key={r.company_name} style={{ borderTop: i > 0 ? '1px solid #F8FAFC' : undefined }}>
                                <td style={{ padding: '8px 0', color: '#374151' }}>{r.company_name}</td>
                                <td style={{ padding: '8px 0', color: '#0F172A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.avg_days}</td>
                                <td style={{ padding: '8px 0', color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>{r.total_confirmed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {stats.company_trends.length > 0 && (
                      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trend per tjänst (topp 10)</p>
                          <button
                            onClick={() => downloadCsv('bliglomd-tjanstetrender.csv', stats.company_trends as unknown as Record<string, unknown>[])}
                            style={{ padding: '5px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#475569', fontWeight: 600 }}
                          >
                            Exportera CSV
                          </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                              {['Tjänst', 'Denna vecka', 'Förra veckan', 'Alla tider'].map(col => (
                                <th key={col} style={{ padding: '0 0 8px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stats.company_trends.map((c, i) => {
                              const delta = c.cnt_this_week - c.cnt_last_week
                              return (
                                <tr key={c.company_name} style={{ borderTop: i > 0 ? '1px solid #F8FAFC' : undefined }}>
                                  <td style={{ padding: '8px 0', color: '#374151' }}>{c.company_name}</td>
                                  <td style={{ padding: '8px 0', color: '#0F172A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                    {c.cnt_this_week} {delta !== 0 && (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: delta > 0 ? '#16A34A' : '#DC2626' }}>
                                        {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 0', color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>{c.cnt_last_week}</td>
                                  <td style={{ padding: '8px 0', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>{c.cnt_all_time}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <p style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'right', margin: 0 }}>
                      {statsLoading ? 'Uppdaterar...' : `Hämtat: ${new Date(stats.generated_at).toLocaleString('sv-SE')} · Uppdateras var 5:e minut`}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── AUDIT TAB ─────────────────────────────────────────────── */}
            {tab === 'audit' && (
              <div>
                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <input
                    type="search"
                    placeholder="Sök användare…"
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  />
                  <select
                    value={auditActionFilter}
                    onChange={e => setAuditActionFilter(e.target.value)}
                    style={{ padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#374151', background: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Alla händelser</option>
                    {AUDIT_ACTIONS.map(a => (
                      <option key={a} value={a}>{ACTION_MAP[a]?.label ?? a}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => downloadCsv('bliglomd-granskningslogg.csv', filteredAudit as unknown as Record<string, unknown>[])}
                    style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}
                  >
                    Exportera CSV
                  </button>
                </div>

                {filteredAudit.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                    <p style={{ margin: '0 0 8px' }}>Ingen loggdata hittades.</p>
                    <p style={{ fontSize: 12 }}>Loggen fylls på automatiskt när admin- och användaråtgärder utförs (rullande 30 dagar).</p>
                  </div>
                ) : (
                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead style={{ background: '#F8FAFC' }}>
                          <tr>
                            {['Tidpunkt', 'Användare', 'Händelse', 'Resurs', 'Metadata', ''].map(col => (
                              <th key={col} style={{ padding: '10px 16px', textAlign: col === '' ? 'right' : 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAudit.map((e, i) => {
                            const matchingDeletion = e.action === 'admin_delete'
                              ? deletions.find(d => d.deleted_user_email === (e.metadata?.deleted_email as string | undefined))
                              : undefined
                            return (
                              <tr key={e.id} style={{ borderTop: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                                <td style={{ padding: '10px 16px', color: '#94A3B8', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(e.created_at)}</td>
                                <td style={{ padding: '10px 16px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.user_email ?? '—'}</td>
                                <td style={{ padding: '10px 16px' }}><ActionBadge action={e.action} /></td>
                                <td style={{ padding: '10px 16px', color: '#94A3B8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                                  {e.resource ?? '—'}
                                </td>
                                <td style={{ padding: '10px 16px', color: '#94A3B8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                                  {e.metadata && Object.keys(e.metadata).length > 0 ? JSON.stringify(e.metadata) : '—'}
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                  {matchingDeletion && (
                                    <button
                                      onClick={() => setSnapshotView(matchingDeletion)}
                                      style={{ padding: '3px 10px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                                    >
                                      Visa data
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CONSENTS TAB ──────────────────────────────────────────── */}
            {tab === 'consents' && (
              <div>
                {consentsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94A3B8' }}>
                    Laddar samtycke...
                  </div>
                ) : (
                  <>
                    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
                      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>Registreringssamtycke ({signupConsents.length})</p>
                        <button
                          onClick={() => downloadCsv('bliglomd-registreringssamtycke.csv', signupConsents as unknown as Record<string, unknown>[])}
                          style={{ padding: '5px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#475569', fontWeight: 600 }}
                        >
                          Exportera CSV
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead style={{ background: '#F8FAFC' }}>
                            <tr>
                              {['Tidpunkt', 'Användare', 'Villkorsversion', 'Policyversion'].map(col => (
                                <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {signupConsents.map((c, i) => (
                              <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                                <td style={{ padding: '10px 16px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtTime(c.consented_at)}</td>
                                <td style={{ padding: '10px 16px', color: '#374151' }}>{c.user_email}</td>
                                <td style={{ padding: '10px 16px', color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>{c.terms_version}</td>
                                <td style={{ padding: '10px 16px', color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>{c.privacy_version ?? '—'}</td>
                              </tr>
                            ))}
                            {signupConsents.length === 0 && (
                              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Inget registreringssamtycke ännu</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>Köpsamtycke ({checkoutConsents.length})</p>
                        <button
                          onClick={() => downloadCsv('bliglomd-kopsamtycke.csv', checkoutConsents as unknown as Record<string, unknown>[])}
                          style={{ padding: '5px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#475569', fontWeight: 600 }}
                        >
                          Exportera CSV
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead style={{ background: '#F8FAFC' }}>
                            <tr>
                              {['Tidpunkt', 'Användare', 'Villkorsversion', 'Pris-ID'].map(col => (
                                <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {checkoutConsents.map((c, i) => (
                              <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                                <td style={{ padding: '10px 16px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtTime(c.consented_at)}</td>
                                <td style={{ padding: '10px 16px', color: '#374151' }}>{c.user_email}</td>
                                <td style={{ padding: '10px 16px', color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>{c.terms_version}</td>
                                <td style={{ padding: '10px 16px', color: '#94A3B8', fontFamily: 'monospace', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.price_id ?? '—'}</td>
                              </tr>
                            ))}
                            {checkoutConsents.length === 0 && (
                              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Inget köpsamtycke ännu</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── USER DETAIL PANEL ─────────────────────────────────────────────── */}
      {selected && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }}
            onClick={() => setSelected(null)}
          />
          <aside style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, background: 'white', borderLeft: '1px solid #E2E8F0', zIndex: 50, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Användardetaljer</h2>
              <button
                onClick={() => setSelected(null)}
                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F1F5F9', cursor: 'pointer', fontSize: 13, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }}>
              {/* Avatar + email */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#2563EB', flexShrink: 0 }}>
                  {selected.email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 2px' }}>{selected.full_name || 'Okänt namn'}</p>
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{selected.email}</p>
                </div>
              </div>

              {/* Info grid */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {[
                  { label: 'Registrerad',   value: fmtDate(selected.created_at) },
                  { label: 'Senast aktiv',  value: selected.last_sign_in_at ? fmtDate(selected.last_sign_in_at) : 'Aldrig' },
                  { label: 'Förfrågningar', value: selected.requests.toString() },
                  { label: 'Skanningar',    value: selected.scans.toString() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Billing */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Betalning</p>
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>Status</span>
                    <SubBadge status={selected.subscription_status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>Stripe-kund</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1E293B' }}>{selected.stripe_customer_id ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>Prenumeration</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1E293B' }}>{selected.stripe_subscription_id ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Full request history */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Förfrågningar {detail && `(${detail.requests.length})`}
                </p>
                {detailLoading ? (
                  <p style={{ fontSize: 12, color: '#94A3B8' }}>Laddar...</p>
                ) : detail && detail.requests.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflow: 'auto' }}>
                    {detail.requests.map(r => (
                      <div key={r.id} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: '#1E293B' }}>{r.company_name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLORS[r.status] ?? '#64748B' }}>{r.status}</span>
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: 11 }}>{fmtDate(r.created_at)}{r.response_at ? ` · svar ${fmtDate(r.response_at)}` : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#CBD5E1' }}>Inga förfrågningar ännu</p>
                )}
              </div>

              {/* Full scan history */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Skanningar {detail && `(${detail.scans.length})`}
                </p>
                {detailLoading ? (
                  <p style={{ fontSize: 12, color: '#94A3B8' }}>Laddar...</p>
                ) : detail && detail.scans.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflow: 'auto' }}>
                    {detail.scans.map(s => (
                      <div key={s.id} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s.scan_email}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: s.breach_count > 0 ? '#DC2626' : '#15803D' }}>{s.breach_count} intrång</span>
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: 11 }}>{fmtDate(s.created_at)}{s.breach_names?.length ? ` · ${s.breach_names.slice(0, 3).join(', ')}` : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#CBD5E1' }}>Inga skanningar ännu</p>
                )}
              </div>

              {/* Consent history */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Samtycke</p>
                {detailLoading ? (
                  <p style={{ fontSize: 12, color: '#94A3B8' }}>Laddar...</p>
                ) : detail && (detail.signup_consent.length > 0 || detail.checkout_consents.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.signup_consent.map(c => (
                      <div key={c.id} style={{ background: '#F0FDF4', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#166534' }}>Registrering — villkor {c.terms_version} / policy {c.privacy_version}</div>
                        <span style={{ color: '#94A3B8', fontSize: 11 }}>{fmtDate(c.consented_at)}</span>
                      </div>
                    ))}
                    {detail.checkout_consents.map(c => (
                      <div key={c.id} style={{ background: '#EFF6FF', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#1D4ED8' }}>Köp — villkor {c.terms_version}</div>
                        <span style={{ color: '#94A3B8', fontSize: 11 }}>{fmtDate(c.consented_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#CBD5E1' }}>Inget samtycke registrerat</p>
                )}
              </div>

              {/* Level selector */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prenumerationsnivå</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([1, 2, 3] as const).map(lvl => (
                    <button
                      key={lvl}
                      disabled={busyUser === selected.id}
                      onClick={() => handleLevelChange(selected.id, lvl)}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.15s',
                        border: `2px solid ${selected.level === lvl ? LVL_FG[lvl] : '#E2E8F0'}`,
                        background: selected.level === lvl ? LVL_BG[lvl] : 'white',
                        color: selected.level === lvl ? LVL_FG[lvl] : '#94A3B8',
                        opacity: busyUser === selected.id ? 0.6 : 1,
                      }}
                    >
                      {LVL_LABEL[lvl]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => handleExport(selected.id)}
                  disabled={exporting}
                  style={{ width: '100%', padding: '11px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: exporting ? 0.6 : 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  {exporting ? 'Exporterar...' : 'Exportera all data (JSON)'}
                </button>

                <button
                  onClick={() => { setShowDelete(true); setDeleteInput('') }}
                  style={{ width: '100%', padding: '11px', borderRadius: 8, border: '1.5px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2"/>
                  </svg>
                  Radera användare
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ── DELETE CONFIRM MODAL ──────────────────────────────────────────── */}
      {showDelete && selected && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => { setShowDelete(false); setDeleteInput('') }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 14, padding: '28px 28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>Radera användare?</h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px', lineHeight: 1.65 }}>
              <strong>{selected.email}</strong> raderas permanent — alla förfrågningar, skanningar och profil tas bort. En raderingsrapport skickas till dig automatiskt via e-post.
            </p>
            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 7px', fontWeight: 600 }}>
              Skriv användarens e-post för att bekräfta:
            </p>
            <input
              type="email"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={selected.email}
              style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${deleteInput === selected.email ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: 8, fontSize: 13, color: '#1E293B', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowDelete(false); setDeleteInput('') }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Avbryt
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== selected.email || deleting}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
                  background: deleteInput === selected.email ? '#DC2626' : '#F1F5F9',
                  color: deleteInput === selected.email ? 'white' : '#94A3B8',
                  cursor: deleteInput === selected.email && !deleting ? 'pointer' : 'not-allowed',
                }}
              >
                {deleting ? 'Raderar...' : 'Radera permanent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETION SNAPSHOT VIEWER ─────────────────────────────────────── */}
      {snapshotView && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => setSnapshotView(null)} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 14, padding: '24px 24px 20px', width: '100%', maxWidth: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Raderingssnapshot — {snapshotView.deleted_user_email}</h3>
              <button
                onClick={() => setSnapshotView(null)}
                style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#F1F5F9', cursor: 'pointer', fontSize: 12, color: '#64748B' }}
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>
            <pre style={{ background: '#F8FAFC', borderRadius: 8, padding: 16, fontSize: 11, overflow: 'auto', margin: 0, color: '#374151', flex: 1 }}>
              {JSON.stringify(snapshotView.snapshot ?? { info: 'Ingen detaljerad snapshot sparad för denna post.' }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
