import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { translations, type Lang, type Translations } from '../lib/i18n'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: Translations
  toggleLang: () => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'sv',
  setLang: () => {},
  t: translations.sv,
  toggleLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem('bliglomd-lang')
      if (stored === 'sv' || stored === 'en') return stored
    } catch {}
    return 'sv'
  })

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('bliglomd-lang', l) } catch {}
  }

  const toggleLang = () => setLang(lang === 'sv' ? 'en' : 'sv')

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang], toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
