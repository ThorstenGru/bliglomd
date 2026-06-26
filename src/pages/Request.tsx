import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { COMPANIES } from '../data/companies'
import { LevelBadge } from '../components/LevelBadge'
import { RequestTypeBadge } from '../components/RequestTypeBadge'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'

export function Request() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const company = COMPANIES.find((c) => c.id === id)

  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!company) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{t.request.notFound}</p>
          <button onClick={() => navigate('/scan')} className="mt-4 text-brand-600 hover:underline">
            {t.request.backToScan}
          </button>
        </div>
      </div>
    )
  }

  const instructions = lang === 'sv' ? company.instructions_sv : company.instructions_en

  const isOptOut = company.request_type === 'opt_out'
  const isAuthority = company.request_type === 'authority'
  const isGdpr = company.request_type === 'gdpr_art17'

  const namePlaceholder = t.request.templateNamePlaceholder
  const emailPlaceholder = t.request.templateEmailPlaceholder

  const templateBody = isOptOut ? t.request.optOutBody : t.request.templateBody

  const mailTemplate = [
    t.request.templateGreeting,
    '',
    templateBody,
    '',
    `${t.request.templateNameLabel}: ${userName || namePlaceholder}`,
    `${t.request.templateEmailLabel}: ${userEmail || emailPlaceholder}`,
    '',
    t.request.templateConfirm,
    '',
    t.request.templateSignOff,
    userName || namePlaceholder,
  ].join('\n')

  async function handleCopy() {
    await navigator.clipboard.writeText(mailTemplate)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSendL3(e: React.FormEvent) {
    e.preventDefault()
    if (!company.gdpr_email) {
      setError(t.request.webformOnly)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const { error: fnError } = await supabase.functions.invoke('send-request', {
        body: {
          companyName: company.name,
          gdprEmail: company.gdpr_email,
          userName,
          userEmail,
        },
      })

      if (fnError) throw new Error(fnError.message)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('requests').insert({
          user_id: user.id,
          company_id: company.id,
          company_name: company.name,
          user_email: userEmail,
          user_name: userName,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200 max-w-md w-full mx-4">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.request.successTitle}</h2>
          <p className="text-gray-600 mb-6">
            {t.request.successMsg} {company.name}. {t.request.successSub}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
          >
            {t.request.toDashboard}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-sm mb-6 flex items-center gap-1">
        {t.common.back}
      </button>

      {/* Company header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <RequestTypeBadge type={company.request_type} />
            {company.utgivningsbevis && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">
                📰 {t.common.utgivningsbevis}
              </span>
            )}
            {company.bankid_required && (
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full font-medium">
                🔒 {t.common.bankid}
              </span>
            )}
            {company.sensitive && (
              <span className="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-medium">
                ⚠️ {t.common.sensitive}
              </span>
            )}
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{company.country}</span>
          </div>
        </div>
        <p className="text-gray-500 text-sm">{company.category}</p>

        {/* Context banners */}
        {company.sensitive && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
            {t.request.sensitiveWarning}
          </div>
        )}
        {isAuthority && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
            {t.request.authorityBanner}
          </div>
        )}
        {isOptOut && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            {t.request.optOutBanner}
          </div>
        )}
        {company.bankid_required && (
          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
            {t.request.bankidRequired}
          </div>
        )}
        {company.warning && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
            ⚠️ {company.warning}
          </div>
        )}
        {company.utgivningsbevis && isGdpr && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            {t.request.utgivningsbevisbadge}
          </div>
        )}
      </div>

      {/* For authority entries: just show L1 guide directly, no level selector */}
      {isAuthority ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">{t.request.instructions}</h2>
          <p className="text-gray-700 text-sm leading-relaxed mb-4">{instructions}</p>
          <a
            href={company.gdpr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            {t.request.openGdpr} {company.name} ↗
          </a>
        </div>
      ) : (
        <>
          {/* Level selector — only show available levels */}
          {(() => {
            const available = (
              [
                company.level1_available ? 1 : null,
                company.level2_available ? 2 : null,
                company.level3_available ? 3 : null,
              ] as const
            ).filter((l): l is 1 | 2 | 3 => l !== null)

            return available.length > 1 ? (
              <div className="flex gap-3 mb-6">
                {available.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-colors ${
                      selectedLevel === level
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <LevelBadge level={level} className="pointer-events-none" />
                  </button>
                ))}
              </div>
            ) : null
          })()}

          {/* L1 — Instructions */}
          {selectedLevel === 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">{t.request.instructions}</h2>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">{instructions}</p>
              <a
                href={company.gdpr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                {t.request.openGdpr} {company.name} ↗
              </a>
            </div>
          )}

          {/* L2 — Template */}
          {selectedLevel === 2 && company.level2_available && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">{t.request.mailTemplate}</h2>
              {company.gdpr_email ? (
                <>
                  <p className="text-sm text-gray-500 mb-1">
                    {t.request.sendTo}: <span className="font-mono text-gray-800">{company.gdpr_email}</span>
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 font-mono text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {mailTemplate}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {copied ? t.request.templateCopied : t.request.copyTemplate}
                  </button>
                </>
              ) : (
                <div className="text-gray-600 text-sm">
                  <p className="mb-3">{t.request.webformOnly}</p>
                  <a
                    href={company.gdpr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
                  >
                    {t.request.openForm} ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {/* L3 — Auto send */}
          {selectedLevel === 3 && company.level3_available && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">{t.request.autoSend}</h2>
              {company.gdpr_email ? (
                <form onSubmit={handleSendL3} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.request.yourName}</label>
                    <input
                      type="text"
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder={t.auth.fullNamePlaceholder}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.request.yourEmail}</label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder={t.scan.placeholder}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? t.request.sending : `${t.request.sendBtn} ${company.name}`}
                  </button>
                </form>
              ) : (
                <div className="text-gray-600 text-sm">
                  <p className="mb-3">{company.name} {t.request.noEmailCompany}</p>
                  <a
                    href={company.gdpr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
                  >
                    {t.request.openGdprForm} ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
