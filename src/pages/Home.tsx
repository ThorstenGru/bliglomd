import { useState } from 'react'
import { AuthModal } from '../components/AuthModal'

export function Home() {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-bold text-xl text-brand-700">BliGlömd</span>
          <button
            onClick={() => setShowAuth(true)}
            className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Logga in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          GDPR Artikel 17 — Rätten till radering
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-4">
          BliGlömd — Ta kontroll<br />över dina personuppgifter
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Skicka GDPR-raderingsförfrågningar till företag på sekunder.
          Vi hanterar allt det juridiska — du behöver bara bekräfta.
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="bg-brand-600 text-white text-lg px-8 py-3.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
        >
          Kom igång gratis
        </button>
        <p className="text-sm text-gray-400 mt-3">Inget kreditkort krävs</p>
      </section>

      {/* Nivå-kort */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Tre nivåer av skydd</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700 font-bold text-lg mb-4">1</div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">L1 — Hitta</h3>
            <p className="text-gray-600 text-sm mb-4">
              Identifiera var dina uppgifter finns. Skärma din e-post mot kända dataintrång och få guidade instruktioner för varje företag.
            </p>
            <span className="text-green-700 font-semibold text-sm">Gratis</span>
          </div>

          <div className="bg-white rounded-2xl border border-brand-200 p-6 shadow-sm ring-1 ring-brand-200">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-lg mb-4">2</div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">L2 — Skicka</h3>
            <p className="text-gray-600 text-sm mb-4">
              Genererar juridiskt korrekt GDPR-mail åt dig med ett klick. Kopia-klistra och skicka direkt — vi sköter formuleringarna.
            </p>
            <span className="text-brand-700 font-semibold text-sm">Plus</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 font-bold text-lg mb-4">3</div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">L3 — Bevaka</h3>
            <p className="text-gray-600 text-sm mb-4">
              Vi skickar mailet åt dig och spårar svaret. Påminnelse automatiskt om företaget inte svarar inom 30 dagar.
            </p>
            <span className="text-purple-700 font-semibold text-sm">Pro</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        <p>© 2026 Thorsten Grund. All rights reserved.</p>
        <p className="mt-1">BliGlömd hjälper dig utöva din rätt enligt GDPR Artikel 17.</p>
      </footer>
    </div>
  )
}
