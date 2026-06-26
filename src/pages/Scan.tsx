import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { COMPANIES } from '../data/companies'
import { CompanyCard } from '../components/CompanyCard'
import type { Company } from '../types'

interface XonBreach {
  breach: string
  xposed_date: string
  domain: string
  industry: string
  xposed_data: string
  xposed_records: number
}

export function Scan() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [breaches, setBreaches] = useState<XonBreach[]>([])
  const [suggestions, setSuggestions] = useState<Company[]>([])
  const [hasScanned, setHasScanned] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('scan-email', {
        body: { email },
      })

      if (fnError) throw new Error(fnError.message)

      const foundBreaches: XonBreach[] = data?.breaches ?? []
      setBreaches(foundBreaches)

      setSuggestions(COMPANIES)
      setHasScanned(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('scans').insert({
          user_id: user.id,
          scan_email: email,
          hibp_breaches: foundBreaches.map((b) => b.breach),
          category_suggestions: COMPANIES,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Skärma din e-post</h1>
        <p className="text-gray-600 mb-8">
          Vi kontrollerar om din e-postadress förekommer i kända dataintrång och visar vilka företag du bör skicka raderingsförfrågningar till.
        </p>

        <form onSubmit={handleScan} className="flex gap-3 mb-10">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@epost.se"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Skärmar...' : 'Skärma min e-post'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>
        )}

        {hasScanned && (
          <>
            {/* Dataintrång */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Dataintrång{' '}
                <span className={`text-base font-normal ${breaches.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({breaches.length} hittade)
                </span>
              </h2>
              {breaches.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
                  Inga kända dataintrång hittades för denna e-postadress.
                </div>
              ) : (
                <div className="space-y-3">
                  {breaches.map((breach) => (
                    <div key={breach.breach} className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-semibold text-red-900">{breach.breach}</span>
                        <span className="text-xs text-red-600">{breach.xposed_date}</span>
                      </div>
                      <p className="text-sm text-red-700 mt-1">{breach.domain}</p>
                      {breach.xposed_data && (
                        <p className="text-xs text-red-500 mt-1">
                          Exponerade uppgifter: {breach.xposed_data}
                        </p>
                      )}
                      {breach.xposed_records > 0 && (
                        <p className="text-xs text-red-400 mt-0.5">
                          {breach.xposed_records.toLocaleString('sv-SE')} poster läcktes
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Företagsförslag */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Skicka raderingsförfrågningar till
              </h2>
              <div className="space-y-3">
                {suggestions.map((company) => (
                  <CompanyCard key={company.id} company={company} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
