import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { AuthModal } from './AuthModal'
import { BrandLogo } from './BrandLogo'
import type { Session } from '@supabase/supabase-js'

interface NavBarProps {
  session: Session | null
}

export function NavBar({ session }: NavBarProps) {
  const { t, toggleLang } = useLang()
  const location = useLocation()
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    const handler = () => setShowAuth(true)
    document.addEventListener('bliglomd:open-auth', handler)
    return () => document.removeEventListener('bliglomd:open-auth', handler)
  }, [])

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-brand-700 font-semibold'
      : 'text-gray-600 hover:text-gray-900'

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 flex items-center justify-between gap-2 sm:gap-4" style={{ height: 60 }}>
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Link to="/" className="shrink-0 leading-none" aria-label="BliGlömd — hem">
              <BrandLogo variant="compact" />
            </Link>
            {session && (
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <Link to="/scan" className={isActive('/scan')}>{t.nav.scan}</Link>
                <Link to="/dashboard" className={isActive('/dashboard')}>{t.nav.dashboard}</Link>
                <Link to="/profile" className={isActive('/profile')}>{t.nav.profile}</Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={toggleLang}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-md px-2 py-1 min-h-[44px] sm:min-h-0 inline-flex items-center transition-colors"
              aria-label="Switch language"
            >
              {t.nav.switchLang}
            </button>

            {session ? (
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-red-600 transition-colors px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg hover:bg-red-50 inline-flex items-center"
              >
                {t.nav.logout}
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="bg-brand-600 text-white text-sm px-4 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg hover:bg-brand-700 transition-colors font-medium inline-flex items-center"
              >
                {t.nav.login}
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav for logged-in users */}
        {session && (
          <div className="sm:hidden border-t border-gray-100 flex text-sm">
            <Link to="/scan" className={`flex-1 text-center py-3 min-h-[44px] flex items-center justify-center ${isActive('/scan')}`}>
              {t.nav.scan}
            </Link>
            <Link to="/dashboard" className={`flex-1 text-center py-3 min-h-[44px] flex items-center justify-center ${isActive('/dashboard')}`}>
              {t.nav.dashboard}
            </Link>
            <Link to="/profile" className={`flex-1 text-center py-3 min-h-[44px] flex items-center justify-center ${isActive('/profile')}`}>
              {t.nav.profile}
            </Link>
          </div>
        )}
      </nav>
    </>
  )
}
