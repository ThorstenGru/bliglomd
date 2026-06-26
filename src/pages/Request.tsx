import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { COMPANIES } from '../data/companies'
import { LevelBadge } from '../components/LevelBadge'
import { supabase } from '../lib/supabase'

export function Request() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const company = COMPANIES.find((c) => c.id === id)

  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Företaget hittades inte.</p>
          <button onClick={() => navigate('/bliglomd/scan')} className="mt-4 text-brand-600 hover:underline">
            Tillbaka till skärming
          </button>
        </div>
      </div>
    )
  }

  const mailTemplate = `Hej,

Jag utövar min rätt enligt GDPR Artikel 17 (rätten till radering) och begär att ni omgående raderar alla personuppgifter som ni behandlar avseende mig.

Namn: ${userName || '[DITT NAMN]'}
E-postadress: ${userEmail || '[DIN E-POST]'}

Vänligen bekräfta skriftligen när raderingen är genomförd, senast inom 30 dagar i enlighet med GDPR Artikel 12.

Med vänliga hälsningar,
${userName || '[DITT NAMN]'}`

  async function handleSendL3(e: React.FormEvent) {
    e.preventDefault()
    if (!company.gdpr_email) {
      setError('Det finns ingen e-postadress tillgänglig för detta företag. Använd webblänken istället.')
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
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200 max-w-md w-full mx-4">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Förfrågan skickad!</h2>
          <p className="text-gray-600 mb-6">
            Din GDPR-raderingsförfrågan har skickats till {company.name}. Du kan följa statusen i din dashboard.
          </p>
          <button
            onClick={() => navigate('/bliglomd/dashboard')}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
          >
            Gå till Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-sm mb-6 flex items-center gap-1">
          ← Tillbaka
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{company.country}</span>
          </div>
          <p className="text-gray-500 text-sm">{company.category}</p>
        </div>

        {/* Nivåväljare */}
        <div className="flex gap-3 mb-6">
          {([1, 2, 3] as const).map((level) => (
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

        {/* L1 — Hitta */}
        {selectedLevel === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Guidade instruktioner</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">{company.instructions_sv}</p>
            <a
              href={company.gdpr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Öppna GDPR-sida hos {company.name} ↗
            </a>
          </div>
        )}

        {/* L2 — Skicka */}
        {selectedLevel === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Färdig mailmall</h2>
            {company.gdpr_email ? (
              <>
                <p className="text-sm text-gray-500 mb-1">Skicka till: <span className="font-mono text-gray-800">{company.gdpr_email}</span></p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 font-mono text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {mailTemplate}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mailTemplate)
                    alert('Mailmall kopierad!')
                  }}
                  className="bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
                >
                  Kopiera mailmall
                </button>
              </>
            ) : (
              <div className="text-gray-600 text-sm">
                <p className="mb-3">Detta företag hanterar raderingsförfrågningar via webbformulär.</p>
                <a
                  href={company.gdpr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
                >
                  Öppna formuläret ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* L3 — Bevaka */}
        {selectedLevel === 3 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Vi skickar och bevakar åt dig</h2>
            {company.gdpr_email ? (
              <form onSubmit={handleSendL3} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ditt fullständiga namn</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Anna Svensson"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Din e-postadress</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="anna@exempel.se"
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
                  {loading ? 'Skickar...' : `Skicka förfrågan till ${company.name}`}
                </button>
              </form>
            ) : (
              <div className="text-gray-600 text-sm">
                <p className="mb-3">
                  {company.name} hanterar inte raderingsförfrågningar via e-post. Använd deras officiella GDPR-formulär.
                </p>
                <a
                  href={company.gdpr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
                >
                  Öppna GDPR-formuläret ↗
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
