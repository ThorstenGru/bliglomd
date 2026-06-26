import { useState, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { AuthModal } from './components/AuthModal'
import { Home } from './pages/Home'
import { Scan } from './pages/Scan'
import { Request } from './pages/Request'
import { Dashboard } from './pages/Dashboard'
import { Status } from './pages/Status'
import type { Session } from '@supabase/supabase-js'

function AuthGuard({ session, children }: { session: Session | null; children: ReactNode }) {
  const [showModal, setShowModal] = useState(false)

  if (!session) {
    return (
      <>
        {showModal ? (
          <AuthModal onClose={() => setShowModal(false)} />
        ) : (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600 mb-4">Du måste vara inloggad för att fortsätta.</p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
              >
                Logga in
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return <>{children}</>
}

export default function App() {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Laddar...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
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
    </BrowserRouter>
  )
}
