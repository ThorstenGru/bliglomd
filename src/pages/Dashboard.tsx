import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/StatusBadge'
import { useLang } from '../contexts/LanguageContext'
import type { Request } from '../types'

export function Dashboard() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setRequests(data as Request[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: Request['status']) {
    const { error } = await supabase
      .from('requests')
      .update({ status, response_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">{t.common.loading}</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">{t.dashboard.colCompany}</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">{t.dashboard.colStatus}</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">{t.dashboard.colSent}</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">{t.dashboard.colResponse}</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">{t.dashboard.colAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{req.company_name}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {req.sent_at ? new Date(req.sent_at).toLocaleDateString('sv-SE') : '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {req.response_at ? new Date(req.response_at).toLocaleDateString('sv-SE') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={req.status}
                      onChange={(e) => updateStatus(req.id, e.target.value as Request['status'])}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="pending">{t.dashboard.pending}</option>
                      <option value="sent">{t.dashboard.sent}</option>
                      <option value="confirmed">{t.dashboard.confirmed}</option>
                      <option value="removed">{t.dashboard.removed}</option>
                      <option value="failed">{t.dashboard.failed}</option>
                      <option value="expired">{t.dashboard.expired}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
