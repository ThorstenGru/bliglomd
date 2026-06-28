import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  email: string
  full_name: string
  level: 1 | 2 | 3
  created_at: string
  last_sign_in_at: string | null
  requests: number
  scans: number
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
}

type Tab = 'overview' | 'users' | 'audit'

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

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    admin_level_change: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Nivåändring' },
    admin_delete:       { bg: '#FEE2E2', fg: '#DC2626', label: 'Radering' },
    admin_export:       { bg: '#FEF9C3', fg: '#92400E', label: 'Export' },
    scan_email:         { bg: '#D1FAE5', fg: '#15803D', label: 'Skanning' },
    send_request:       { bg: '#F3E8FF', fg: '#6B21A8', label: 'Förfrågan' },
  }
  const s = map[action] ?? { bg: '#F1F5F9', fg: '#64748B', label: action }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.fg, background: s.bg, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── SidebarIcon ───────────────────────────────────────────────────────────────

const ICONS: Record<Tab, string> = {
  overview: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3h2v-2h-2v-2h-2v2h-2v2h2v2h2zm4 2h2v-2h-2z',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
  audit:    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',
}

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Översikt',
  users:    'Användare',
  audit:    'Granskningslogg',
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
        .select('id, deleted_user_email, deleted_by_email, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (!usersRes.error) setUsers(usersRes.data?.users ?? [])
    if (!auditRes.error)  setAudit(auditRes.data ?? [])
    if (!deletionsRes.error) setDeletions(deletionsRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.user_metadata?.role !== 'admin') {
        navigate('/', { replace: true })
        return
      }
      setAdminEmail(user.email ?? '')
      setReady(true)
      loadAll()
    })
  }, [navigate, loadAll])

  useEffect(() => {
    const t = setInterval(() => setTimer(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  function showNotice(type: 'ok' | 'err', msg: string) {
    setNotice({ type, msg })
    setTimeout(() => setNotice(null), 4000)
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

  if (!ready) return null

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q)
    const matchLvl = !lvlFilter || u.level === Number(lvlFilter)
    return matchSearch && matchLvl
  })

  const lvlCounts = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>
  users.forEach(u => lvlCounts[u.level]++)
  const totalReqs  = users.reduce((s, u) => s + u.requests, 0)
  const totalScans = users.reduce((s, u) => s + u.scans, 0)

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
          {(['overview', 'users', 'audit'] as Tab[]).map(t => (
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
            onClick={loadAll}
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
                          {['Användare', 'Raderades av', 'Tidpunkt'].map(col => (
                            <th key={col} style={{ textAlign: 'left', padding: '0 0 8px', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11 }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deletions.slice(0, 5).map(d => (
                          <tr key={d.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                            <td style={{ padding: '8px 0', color: '#374151' }}>{d.deleted_user_email}</td>
                            <td style={{ padding: '8px 0', color: '#64748B' }}>{d.deleted_by_email}</td>
                            <td style={{ padding: '8px 0', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(d.created_at)}</td>
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
                </div>

                {/* Table */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ background: '#F8FAFC' }}>
                        <tr>
                          {['E-post', 'Namn', 'Nivå', 'Förfrågn.', 'Skann.', 'Registrerad', 'Senast aktiv', ''].map(col => (
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
                            <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
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

            {/* ── AUDIT TAB ─────────────────────────────────────────────── */}
            {tab === 'audit' && (
              <div>
                {audit.length === 0 && deletions.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                    <p style={{ margin: '0 0 8px' }}>Ingen loggdata ännu.</p>
                    <p style={{ fontSize: 12 }}>Loggen fylls på automatiskt när admin- och användaråtgärder utförs.</p>
                  </div>
                ) : (
                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead style={{ background: '#F8FAFC' }}>
                          <tr>
                            {['Tidpunkt', 'Användare', 'Händelse', 'Resurs'].map(col => (
                              <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {audit.map((e, i) => (
                            <tr key={e.id} style={{ borderTop: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                              <td style={{ padding: '10px 16px', color: '#94A3B8', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(e.created_at)}</td>
                              <td style={{ padding: '10px 16px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.user_email ?? '—'}</td>
                              <td style={{ padding: '10px 16px' }}><ActionBadge action={e.action} /></td>
                              <td style={{ padding: '10px 16px', color: '#94A3B8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                                {e.resource ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
    </div>
  )
}
