import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { COMPANIES_SORTED } from '../data/companies'
import { CompanyCard } from '../components/CompanyCard'
import { useLang } from '../contexts/LanguageContext'

const mediaCompanies   = COMPANIES_SORTED.filter((c) => c.request_type === 'gdpr_art17' && c.utgivningsbevis)
const gdprCompanies    = COMPANIES_SORTED.filter((c) => c.request_type === 'gdpr_art17' && !c.utgivningsbevis)
const optOutCompanies  = COMPANIES_SORTED.filter((c) => c.request_type === 'opt_out')
const authorityEntries = COMPANIES_SORTED.filter((c) => c.request_type === 'authority')

interface XonBreach {
  breach: string
  xposed_date: string
  domain: string
  industry: string
  xposed_data: string
  xposed_records: number
}

export function Scan() {
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [breaches, setBreaches] = useState<XonBreach[]>([])
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
      setHasScanned(true)

      // Save scan history — non-blocking; requires migration 002
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('scans').insert({
            user_id: user.id,
            scan_email: email,
            breach_names: foundBreaches.map((b) => b.breach),
            breach_count: foundBreaches.length,
          }).then(({ error }) => {
            if (error) console.warn('scan save failed:', error.message)
          })
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.scan.title}</h1>
      <p className="text-gray-600 mb-8">{t.scan.subtitle}</p>

      <form onSubmit={handleScan} className="flex gap-3 mb-10">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.scan.placeholder}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? t.scan.btnLoading : t.scan.btn}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>
      )}

      {hasScanned && (
        <>
          {/* Breaches */}
          <div className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t.scan.breachTitle}{' '}
              <span className={`text-base font-normal ${breaches.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ({breaches.length} {t.scan.found})
              </span>
            </h2>
            {breaches.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
                {t.scan.noBreaches}
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
                        {t.scan.exposedData}: {breach.xposed_data}
                      </p>
                    )}
                    {breach.xposed_records > 0 && (
                      <p className="text-xs text-red-400 mt-0.5">
                        {breach.xposed_records.toLocaleString('sv-SE')} {t.scan.recordsLeaked}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Companies — grouped by type */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.scan.companiesTitle}</h2>

            <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>📰</span> {t.scan.mediaFirst}
            </h3>
            <div className="space-y-3 mb-8">
              {mediaCompanies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>

            <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>✅</span> {t.scan.gdprCompanies}
            </h3>
            <div className="space-y-3 mb-8">
              {gdprCompanies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>

            <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>🔒</span> {t.scan.optOutSites}
            </h3>
            <div className="space-y-3 mb-8">
              {optOutCompanies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>

            <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>🏛️</span> {t.scan.authorityTools}
            </h3>
            <div className="space-y-3">
              {authorityEntries.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
