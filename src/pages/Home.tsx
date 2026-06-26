import { Link } from 'react-router-dom'
import { useLang } from '../contexts/LanguageContext'
import type { Session } from '@supabase/supabase-js'

interface HomeProps {
  session: Session | null
}

export function Home({ session }: HomeProps) {
  const { t } = useLang()

  return (
    <div className="bg-gradient-to-br from-brand-50 to-white">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          {t.home.badge}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
          {t.home.title}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          {t.home.subtitle}
        </p>

        {session ? (
          <Link
            to="/scan"
            className="inline-block bg-brand-600 text-white text-lg px-8 py-3.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
          >
            {t.nav.scan}
          </Link>
        ) : (
          <Link
            to="/"
            onClick={(e) => {
              e.preventDefault()
              document.dispatchEvent(new CustomEvent('bliglomd:open-auth'))
            }}
            className="inline-block bg-brand-600 text-white text-lg px-8 py-3.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
          >
            {t.home.cta}
          </Link>
        )}
        <p className="text-sm text-gray-400 mt-3">{t.home.ctaSub}</p>
      </section>

      {/* Utgivningsbevis banner */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3 text-sm text-amber-800">
          <span className="text-amber-500 text-lg">📰</span>
          {t.home.utgivningsbevisbanner}
        </div>
      </section>

      {/* Level cards */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">{t.home.levelsTitle}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700 font-bold text-lg mb-4">1</div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">{t.home.l1Title}</h3>
            <p className="text-gray-600 text-sm mb-4">{t.home.l1Desc}</p>
            <span className="text-green-700 font-semibold text-sm">{t.home.l1Tag}</span>
          </div>

          <div className="bg-white rounded-2xl border border-brand-200 p-6 shadow-sm ring-1 ring-brand-200">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-lg mb-4">2</div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">{t.home.l2Title}</h3>
            <p className="text-gray-600 text-sm mb-4">{t.home.l2Desc}</p>
            <span className="text-brand-700 font-semibold text-sm">{t.home.l2Tag}</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 font-bold text-lg mb-4">3</div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">{t.home.l3Title}</h3>
            <p className="text-gray-600 text-sm mb-4">{t.home.l3Desc}</p>
            <span className="text-purple-700 font-semibold text-sm">{t.home.l3Tag}</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        <p>{t.home.footer}</p>
        <p className="mt-1">{t.home.footerSub}</p>
        <Link to="/status" className="mt-2 inline-block text-gray-400 hover:text-gray-600 underline">
          {t.home.footerStatus}
        </Link>
      </footer>
    </div>
  )
}
