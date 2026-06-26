import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LanguageProvider, useLang } from './contexts/LanguageContext'
import { NavBar } from './components/NavBar'
import { Home } from './pages/Home'
import { Scan } from './pages/Scan'
import { Request } from './pages/Request'
import { Dashboard } from './pages/Dashboard'
import { Status } from './pages/Status'
import type { Session } from '@supabase/supabase-js'

function AuthGuard({ session, children }: { session: Session | null; children: ReactNode }) {
  const { t } = useLang()

  const openAuth = useCallback(() => {
    document.dispatchEvent(new CustomEvent('bliglomd:open-auth'))
  }, [])

  if (!session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{t.nav.login}</p>
          <button
            onClick={openAuth}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
          >
            {t.nav.login}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function AppShell() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <p className="text-gray-400">Laddar...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-50">
      <NavBar session={session} />
      <Routes>
        <Route path="/" element={<Home session={session} />} />
        <Route path="/scan" element={
          <AuthGuard session={session}><Scan /></AuthGuard>
        } />
        <Route path="/request/:id" element={
          <AuthGuard session={session}><Request /></AuthGuard>
        } />
        <Route path="/dashboard" element={
          <AuthGuard session={session}><Dashboard /></AuthGuard>
        } />
        <Route path="/status" element={<Status />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </LanguageProvider>
  )
}
