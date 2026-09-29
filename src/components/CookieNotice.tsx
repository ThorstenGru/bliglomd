import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../contexts/LanguageContext'

const STORAGE_KEY = 'bliglomd_cookie_notice_dismissed_v1'

// This is a disclosure, not a consent gate — there is nothing non-essential to
// opt in/out of (see Privacy §7): only strictly-necessary localStorage for
// sign-in and anonymous, session-only first-party analytics. A fake
// Accept/Reject choice would misrepresent that as something it isn't.
export function CookieNotice() {
  const { t } = useLang()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-0 inset-x-0 z-[150] bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <p className="text-xs text-gray-600 leading-relaxed flex-1">
          {t.cookieNotice.body}{' '}
          <Link to="/privacy" className="text-brand-600 underline whitespace-nowrap">
            {t.cookieNotice.link}
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="w-full sm:w-auto shrink-0 bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-colors"
        >
          {t.cookieNotice.accept}
        </button>
      </div>
    </div>
  )
}
