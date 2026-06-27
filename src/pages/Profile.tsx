import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'

export function Profile() {
  const navigate = useNavigate()
  const { t } = useLang()

  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [emailSaving, setEmailSaving] = useState(false)
  const [emailDone, setEmailDone] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }
    setEmail(user.email ?? '')

    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (data) setFullName(data.full_name ?? '')
    setLoading(false)
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setNameSaving(true)
    setNameError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id)
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

  async function deleteAccount() {
    if (deleteWord.toLowerCase() !== t.profile.deleteConfirmWord) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.functions.invoke('delete-account', { body: {} })
    if (error) {
      setDeleting(false)
      setDeleteError(error.message)
      return
    }
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
