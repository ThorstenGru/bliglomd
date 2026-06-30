import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/StatusBadge'
import { useLang } from '../contexts/LanguageContext'
import type { Request } from '../types'

const statusBorder: Record<Request['status'], string> = {
  pending:   'border-l-gray-300',
  sent:      'border-l-blue-400',
  confirmed: 'border-l-green-500',
  removed:   'border-l-green-600',
  failed:    'border-l-red-500',
  expired:   'border-l-amber-400',
}

function formatDate(iso: string | null, locale: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function daysUntil(iso: string, totalDays: number) {
  const elapsed = daysSince(iso)
  return Math.max(0, totalDays - elapsed)
}

interface TimelineEvent {
  done: boolean
  label: string
  sub?: string
  date?: string | null
}

export function Dashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const upgraded = searchParams.get('upgraded') === '1'
  const { t, lang } = useLang()
  const locale = lang === 'sv' ? 'sv-SE' : 'en-GB'
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSavedId, setNoteSavedId] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setRequests(data as Request[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  async function saveNote(id: string) {
    setNoteSaving(true)
    const { error } = await supabase
      .from('requests')
      .update({ notes: noteText.trim() || null })
      .eq('id', id)
    setNoteSaving(false)
    if (!error) {
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, notes: noteText.trim() || null } : r))
      setNoteSavedId(id)
      setTimeout(() => setNoteSavedId(null), 2000)
    }
  }

  async function updateStatus(id: string, status: Request['status']) {
    const isResponseState = status === 'confirmed' || status === 'removed' ||
                            status === 'failed' || status === 'expired'
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('requests')
      .update(isResponseState ? { status, response_at: now } : { status })
      .eq('id', id)

    if (!error) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status, ...(isResponseState && { response_at: now }) }
            : r
        )
      )
    }
  }

  function buildTimeline(req: Request): TimelineEvent[] {
    const events: TimelineEvent[] = []

    events.push({
      done: true,
      label: t.dashboard.timeline.created,
      date: formatDate(req.created_at, locale),
    })

    if (req.sent_at) {
      events.push({
        done: true,
        label: t.dashboard.timeline.sent,
        sub: req.user_email,
        date: formatDate(req.sent_at, locale),
      })

      if (req.response_at) {
        events.push({
          done: true,
          label: t.dashboard.timeline.responseReceived,
          date: formatDate(req.response_at, locale),
        })
      } else if (req.status === 'sent') {
        const elapsed = daysSince(req.sent_at)
        const remaining = daysUntil(req.sent_at, 30)
        events.push({
          done: false,
          label: t.dashboard.timeline.waitingResponse,
          sub: `${elapsed} ${t.common.days} ${t.dashboard.timeline.elapsed} · ${remaining} ${t.common.days} ${t.dashboard.timeline.remaining}`,
        })
      }
    } else {
      events.push({
        done: false,
        label: t.dashboard.timeline.notSentYet,
        sub: t.dashboard.timeline.notSentYetSub,
      })
    }

    if (req.status === 'confirmed') {
      events.push({ done: true, label: t.dashboard.timeline.confirmed, date: formatDate(req.response_at, locale) })
    } else if (req.status === 'removed') {
      events.push({ done: true, label: t.dashboard.timeline.dataDeleted, date: formatDate(req.response_at, locale) })
    } else if (req.status === 'failed') {
      events.push({ done: false, label: t.dashboard.timeline.failed, sub: t.dashboard.timeline.failedSub })
    } else if (req.status === 'expired') {
      events.push({ done: false, label: t.dashboard.timeline.expired, sub: t.dashboard.timeline.expiredSub })
    }

    if (req.notes) {
      events.push({ done: true, label: t.dashboard.timeline.note, sub: req.notes })
    }

    return events
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">{t.common.loading}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {upgraded && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p className="text-sm text-green-800 font-medium">
            {t.dashboard.upgradedBanner}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t.dashboard.title}</h1>
        <button
          onClick={() => navigate('/scan')}
          className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {t.dashboard.newScan}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">{t.dashboard.emptyTitle}</p>
          <p className="text-gray-400 text-sm mb-6">{t.dashboard.emptySub}</p>
          <button
            onClick={() => navigate('/scan')}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
          >
            {t.dashboard.emptyCta}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isExpanded = expandedId === req.id
            const timeline = isExpanded ? buildTimeline(req) : []

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border border-gray-200 border-l-4 ${statusBorder[req.status]} overflow-hidden transition-shadow hover:shadow-sm`}
              >
                {/* Summary row — always visible, click to expand */}
                <button
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedId(null)
                    } else {
                      setExpandedId(req.id)
                      setNoteText(req.notes ?? '')
                    }
                  }}
                  className="w-full text-left px-5 py-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-900">{req.company_name}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      {req.sent_at
                        ? <span>{t.dashboard.colSent}: {new Date(req.sent_at).toLocaleDateString(locale)}</span>
                        : <span className="italic">{t.dashboard.timeline.notSentYet}</span>
                      }
                      {req.response_at && (
                        <span>{t.dashboard.colResponse}: {new Date(req.response_at).toLocaleDateString(locale)}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-gray-400 text-sm select-none">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-5 bg-gray-50">
                    {/* Timeline */}
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                      {t.dashboard.timeline.title}
                    </p>
                    <ol className="space-y-4 mb-6">
                      {timeline.map((ev, i) => (
                        <li key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${
                              ev.done ? 'bg-brand-600' : 'bg-gray-300'
                            }`} />
                            {i < timeline.length - 1 && (
                              <div className="w-px flex-1 bg-gray-200 mt-1" />
                            )}
                          </div>
                          <div className="pb-4 min-w-0">
                            <p className={`text-sm font-medium ${ev.done ? 'text-gray-800' : 'text-gray-400'}`}>
                              {ev.label}
                            </p>
                            {ev.sub && (
                              <p className="text-xs text-gray-400 mt-0.5 break-words">{ev.sub}</p>
                            )}
                            {ev.date && (
                              <p className="text-xs text-gray-400 mt-0.5">{ev.date}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>

                    {/* Action: update status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-xs font-medium text-gray-600">{t.dashboard.updateStatus}</label>
                      <select
                        value={req.status}
                        onChange={(e) => updateStatus(req.id, e.target.value as Request['status'])}
                        className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                      >
                        <option value="pending">{t.dashboard.pending}</option>
                        <option value="sent">{t.dashboard.sent}</option>
                        <option value="confirmed">{t.dashboard.confirmed}</option>
                        <option value="removed">{t.dashboard.removed}</option>
                        <option value="failed">{t.dashboard.failed}</option>
                        <option value="expired">{t.dashboard.expired}</option>
                      </select>

                      <button
                        onClick={() => navigate(`/request/${req.company_id}`)}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        {t.dashboard.goToRequest} →
                      </button>
                    </div>

                    {/* Notes */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">{t.dashboard.addNote}</p>
                      <div className="flex gap-2">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          rows={2}
                          placeholder={t.dashboard.notePlaceholder}
                          className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                        />
                        <button
                          onClick={() => saveNote(req.id)}
                          disabled={noteSaving}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors self-end ${
                            noteSavedId === req.id
                              ? 'bg-green-600 text-white'
                              : 'bg-brand-600 text-white hover:bg-brand-700'
                          } disabled:opacity-50`}
                        >
                          {noteSavedId === req.id ? t.dashboard.noteSaved : noteSaving ? '…' : t.dashboard.saveNote}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
