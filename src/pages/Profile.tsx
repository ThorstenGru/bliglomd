import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { LevelBadge } from '../components/LevelBadge'
import { TIERS } from '../config/tiers'

const tierColor = {
  green:  { ring: 'border-green-300',  bg: 'bg-green-50',  btn: 'bg-green-600 hover:bg-green-700',  text: 'text-green-700'  },
  blue:   { ring: 'border-blue-300',   bg: 'bg-blue-50',   btn: 'bg-blue-600 hover:bg-blue-700',   text: 'text-blue-700'   },
  purple: { ring: 'border-purple-300', bg: 'bg-purple-50', btn: 'bg-purple-600 hover:bg-purple-700', text: 'text-purple-700' },
} as const

export function Profile() {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [level, setLevel] = useState<1 | 2 | 3>(1)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive')
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)

  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [emailSaving, setEmailSaving] = useState(false)
  const [emailDone, setEmailDone] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }
    setEmail(user.email ?? '')

    const { data } = await supabase
      .from('profiles')
      .select('full_name, level, subscription_status, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (data) {
      setFullName(data.full_name ?? '')
      setLevel((data.level as 1 | 2 | 3) ?? 1)
      setSubscriptionStatus(data.subscription_status ?? 'inactive')
      setStripeCustomerId(data.stripe_customer_id ?? null)
    }
    setLoading(false)
  }, [navigate])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setNameSaving(true)
    setNameError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    setNameSaving(false)
    if (error) { setNameError(error.message); return }
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2500)
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailSaving(true)
    setEmailError(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailSaving(false)
    if (error) { setEmailError(error.message); return }
    setEmailDone(true)
    setNewEmail('')
  }

  async function startCheckout(priceId: string) {
    setUpgrading(priceId)
    setStripeError(null)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { priceId } })
      if (error || !data?.url) throw new Error(error?.message ?? 'No URL returned')
      window.location.href = data.url
    } catch (err) {
      setStripeError(String(err))
      setUpgrading(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    setStripeError(null)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', { body: {} })
      if (error || !data?.url) throw new Error(error?.message ?? 'No URL returned')
      window.location.href = data.url
    } catch (err) {
      setStripeError(String(err))
      setPortalLoading(false)
    }
  }

  async function deleteAccount() {
    if (deleteWord.toLowerCase() !== t.profile.deleteConfirmWord) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.functions.invoke('delete-account', { body: {} })
    if (error) { setDeleting(false); setDeleteError(error.message); return }
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">{t.common.loading}</p>
      </div>
    )
  }

  const upgradableTiers = ([2, 3] as const).filter(l => l > level)
  const hasActiveSubscription = stripeCustomerId !== null && level > 1

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">{t.profile.title}</h1>

      {/* Name */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t.profile.nameLabel}</h2>
        <form onSubmit={saveName} className="flex gap-3">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={t.auth.fullNamePlaceholder}
          />
          <button
            type="submit"
            disabled={nameSaving}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
              nameSaved ? 'bg-green-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {nameSaved ? t.profile.nameSaved : nameSaving ? t.auth.waiting : t.profile.saveNameBtn}
          </button>
        </form>
        {nameError && <p className="text-xs text-red-600 mt-2">{nameError}</p>}
      </div>

      {/* Email */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-2">{t.profile.emailLabel}</h2>
        <p className="text-sm text-gray-500 font-mono mb-5">{email}</p>
        <h3 className="text-sm font-medium text-gray-700 mb-3">{t.profile.changeEmail}</h3>
        {emailDone ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{t.profile.changeEmailDone}</p>
        ) : (
          <form onSubmit={changeEmail} className="flex gap-3">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t.profile.newEmailLabel}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={emailSaving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {emailSaving ? t.auth.waiting : t.profile.changeEmailBtn}
            </button>
          </form>
        )}
        {emailError && <p className="text-xs text-red-600 mt-2">{emailError}</p>}
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">{t.profile.subscription}</h2>

        {/* Current plan */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t.profile.currentPlan}</p>
            <div className="flex items-center gap-2">
              <LevelBadge level={level} />
              {level > 1 && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                  subscriptionStatus === 'past_due' ? 'bg-yellow-100 text-yellow-700' :
                  subscriptionStatus === 'canceled' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {subscriptionStatus === 'active' ? t.profile.statusActive :
                   subscriptionStatus === 'past_due' ? t.profile.statusPastDue :
                   subscriptionStatus === 'canceled' ? t.profile.statusCanceled :
                   subscriptionStatus}
                </span>
              )}
            </div>
          </div>
          {hasActiveSubscription && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {portalLoading ? t.profile.upgrading : t.profile.manageBtn}
            </button>
          )}
        </div>

        {/* Upgrade cards */}
        {upgradableTiers.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{t.profile.upgradeTitle}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {upgradableTiers.map((l) => {
                const tier = TIERS[l]
                const c = tierColor[tier.color]
                const isLoading = upgrading === tier.stripeMonthlyPriceId
                return (
                  <div key={l} className={`rounded-xl border-2 ${c.ring} ${c.bg} p-4 flex flex-col gap-2`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-sm ${c.text}`}>{tier.name}</span>
                      <span className={`text-sm font-medium ${c.text}`}>
                        {tier.monthlyPriceSEK} kr{t.profile.perMonth}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{tier.tagline[lang]}</p>
                    <button
                      onClick={() => tier.stripeMonthlyPriceId && startCheckout(tier.stripeMonthlyPriceId)}
                      disabled={!!upgrading || isLoading}
                      className={`mt-1 w-full py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${c.btn}`}
                    >
                      {isLoading ? t.profile.upgrading : `${t.profile.upgradeBtn} ${tier.name}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {stripeError && <p className="text-xs text-red-600">{stripeError}</p>}
      </div>

      {/* Your data */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">{t.profile.yourData}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{t.profile.dataInfo}</p>
      </div>

      {/* Delete account */}
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <h2 className="font-semibold text-red-800 mb-2">{t.profile.deleteSection}</h2>
        <p className="text-sm text-gray-600 mb-4">{t.profile.deleteWarning}</p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
          >
            {t.profile.deleteBtn}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">{t.profile.deleteConfirmMsg}</p>
            <input
              type="text"
              value={deleteWord}
              onChange={(e) => setDeleteWord(e.target.value)}
              className="w-full border border-red-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder={t.profile.deleteConfirmWord}
            />
            {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={deleteAccount}
                disabled={deleting || deleteWord.toLowerCase() !== t.profile.deleteConfirmWord}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? t.auth.waiting : t.profile.deleteConfirmBtn}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteWord(''); setDeleteError(null) }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                {t.profile.deleteCancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
