import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'

type StatusValue = 'operational' | 'degraded' | 'down' | 'checking' | 'unconfigured'
type Category = 'frontend' | 'backend' | 'database' | 'edge_functions' | 'external'

interface CheckResult {
  status: StatusValue
  responseTime?: number
  detail?: string
}

interface ComponentDef {
  id: string
  category: Category
  docsUrl?: string
  check: () => Promise<CheckResult>
}

const SB_URL: string = import.meta.env.VITE_SUPABASE_URL || ''
const SB_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 7000): Promise<Response> {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) })
}

const COMPONENTS: ComponentDef[] = [
  {
    id: 'frontend',
    category: 'frontend',
    docsUrl: 'https://xn--bliglmd-e1a.se/',
    check: async () => ({ status: 'operational', detail: window.location.origin }),
  },
  {
    id: 'supabase_platform',
    category: 'backend',
    docsUrl: `${SB_URL}/rest/v1/`,
    check: async () => {
      if (!SB_URL || !SB_KEY) return { status: 'unconfigured', detail: 'VITE_SUPABASE_URL not set' }
      const t0 = performance.now()
      try {
        const r = await fetchWithTimeout(`${SB_URL}/rest/v1/`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        })
        const ms = Math.round(performance.now() - t0)
        if (r.ok) return { status: 'operational', responseTime: ms }
        // Publishable keys are deliberately blocked from this OpenAPI introspection
        // endpoint by Supabase's newer API-key system ("Secret API key required") —
        // a structured 401 here proves the gateway is alive and enforcing that policy
        // correctly, not that anything is actually broken.
        if (r.status === 401) {
          const body = await r.json().catch(() => null)
          if (body?.message === 'Secret API key required') {
            return { status: 'operational', responseTime: ms }
          }
        }
        return { status: 'degraded', responseTime: ms, detail: `HTTP ${r.status}` }
      } catch {
        return { status: 'down', responseTime: Math.round(performance.now() - t0) }
      }
    },
  },
  {
    id: 'supabase_auth',
    category: 'backend',
    docsUrl: `${SB_URL}/auth/v1/health`,
    check: async () => {
      if (!SB_URL || !SB_KEY) return { status: 'unconfigured' }
      const t0 = performance.now()
      try {
        // Supabase's gateway requires an apikey header on every path, including /health.
        const r = await fetchWithTimeout(`${SB_URL}/auth/v1/health`, {
          headers: { apikey: SB_KEY },
        })
        const ms = Math.round(performance.now() - t0)
        return { status: r.ok ? 'operational' : 'degraded', responseTime: ms, detail: r.ok ? undefined : `HTTP ${r.status}` }
      } catch {
        return { status: 'down', responseTime: Math.round(performance.now() - t0) }
      }
    },
  },
  {
    id: 'supabase_db',
    category: 'database',
    check: async () => {
      if (!SB_URL) return { status: 'unconfigured' }
      const t0 = performance.now()
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1)
        const ms = Math.round(performance.now() - t0)
        if (error) {
          // RLS / JWT errors mean DB is running but secured — operational
          const isSecurityError =
            error.message.toLowerCase().includes('jwt') ||
            error.message.toLowerCase().includes('permission') ||
            error.code === '42501' ||
            error.code === 'PGRST301'
          return {
            status: isSecurityError ? 'operational' : 'degraded',
            responseTime: ms,
            detail: isSecurityError ? 'Secured with RLS' : error.message,
          }
        }
        return { status: 'operational', responseTime: ms }
      } catch {
        return { status: 'down', responseTime: Math.round(performance.now() - t0) }
      }
    },
  },
  {
    id: 'edge_send',
    category: 'edge_functions',
    check: async () => {
      if (!SB_URL || !SB_KEY) return { status: 'unconfigured' }
      const t0 = performance.now()
      try {
        const r = await fetchWithTimeout(
          `${SB_URL}/functions/v1/send-request`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          },
          8000
        )
        const ms = Math.round(performance.now() - t0)
        if (r.status === 404) return { status: 'down', responseTime: ms, detail: 'Not deployed' }
        if (r.status >= 500) return { status: 'degraded', responseTime: ms, detail: `HTTP ${r.status}` }
        return { status: 'operational', responseTime: ms }
      } catch {
        return { status: 'down', responseTime: Math.round(performance.now() - t0) }
      }
    },
  },
  {
    id: 'edge_scan',
    category: 'edge_functions',
    check: async () => {
      if (!SB_URL || !SB_KEY) return { status: 'unconfigured' }
      const t0 = performance.now()
      try {
        const r = await fetchWithTimeout(
          `${SB_URL}/functions/v1/scan-email`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          },
          8000
        )
        const ms = Math.round(performance.now() - t0)
        if (r.status === 404) return { status: 'down', responseTime: ms, detail: 'Not deployed' }
        if (r.status >= 500) return { status: 'degraded', responseTime: ms, detail: `HTTP ${r.status}` }
        return { status: 'operational', responseTime: ms }
      } catch {
        return { status: 'down', responseTime: Math.round(performance.now() - t0) }
      }
    },
  },
  {
    id: 'resend',
    category: 'external',
    docsUrl: 'https://resend.com',
    check: async () => {
      const t0 = performance.now()
      try {
        await fetchWithTimeout('https://api.resend.com/', { mode: 'no-cors' }, 8000)
        return { status: 'operational', responseTime: Math.round(performance.now() - t0) }
      } catch {
        return { status: 'down', responseTime: Math.round(performance.now() - t0) }
      }
    },
  },
  {
    id: 'hibp',
    category: 'external',
    docsUrl: 'https://xposedornot.com',
    check: async () => {
      const t0 = performance.now()
      try {
        await fetchWithTimeout('https://api.xposedornot.com/', { mode: 'no-cors' }, 8000)
        return { status: 'operational', responseTime: Math.round(performance.now() - t0) }
      } catch {
        return { status: 'down', responseTime: Math.round(performance.now() - t0) }
      }
    },
  },
]

// ─── Translations ──────────────────────────────────────────────────────────────

const T = {
  sv: {
    title: 'Systemstatus',
    subtitle: 'Realtidsstatus för alla BliGlömd-komponenter',
    overall: {
      operational: 'Alla system fungerar normalt',
      degraded: 'Vissa system har begränsad kapacitet',
      down: 'Kritiska systemfel har upptäckts',
      checking: 'Kontrollerar alla system...',
    },
    lastChecked: 'Senast kontrollerat',
    never: 'Aldrig',
    refresh: 'Uppdatera',
    refreshing: 'Kontrollerar...',
    autoRefresh: 'Auto-uppdatering var 30 sek',
    responseTime: 'Svarstid',
    ms: 'ms',
    categories: {
      frontend: 'Frontend',
      backend: 'Backend-plattform',
      database: 'Databas',
      edge_functions: 'Edge Functions (Serverless)',
      external: 'Externa tjänster',
    },
    statusLabel: {
      operational: 'Driftsäker',
      degraded: 'Försämrad',
      down: 'Nere',
      checking: 'Kontrollerar...',
      unconfigured: 'Ej konfigurerad',
    },
    components: {
      frontend: {
        name: 'Webbapp (GitHub Pages)',
        desc: 'React-appen du använder just nu — hostad på GitHub Pages',
      },
      supabase_platform: {
        name: 'Supabase Platform',
        desc: 'Huvudplattform som driver databas, autentisering och Edge Functions',
      },
      supabase_auth: {
        name: 'Supabase Auth',
        desc: 'Autentiseringstjänst — hanterar inloggning, registrering och sessioner',
      },
      supabase_db: {
        name: 'Supabase Databas (PostgreSQL)',
        desc: 'Lagrar GDPR-förfrågningar, användarprofiler, skanningar och påminnelser',
      },
      edge_send: {
        name: 'Edge Function: send-request',
        desc: 'Serverlös funktion som skickar GDPR-raderingsmail via Resend API',
      },
      edge_scan: {
        name: 'Edge Function: scan-email',
        desc: 'Serverlös funktion som söker dataintrång via HaveIBeenPwned API',
      },
      resend: {
        name: 'Resend Mail API',
        desc: 'Extern e-posttjänst — levererar GDPR-raderingsmail till företagen',
      },
      hibp: {
        name: 'XposedOrNot API',
        desc: 'Gratis extern tjänst — kontrollerar om e-postadressen förekommer i dataintrång',
      },
    },
    backHome: '← Hem',
  },
  en: {
    title: 'System Status',
    subtitle: 'Real-time status of all BliGlömd components',
    overall: {
      operational: 'All systems operational',
      degraded: 'Some systems experiencing reduced capacity',
      down: 'Critical system failures detected',
      checking: 'Checking all systems...',
    },
    lastChecked: 'Last checked',
    never: 'Never',
    refresh: 'Refresh',
    refreshing: 'Checking...',
    autoRefresh: 'Auto-refresh every 30 sec',
    responseTime: 'Response time',
    ms: 'ms',
    categories: {
      frontend: 'Frontend',
      backend: 'Backend Platform',
      database: 'Database',
      edge_functions: 'Edge Functions (Serverless)',
      external: 'External Services',
    },
    statusLabel: {
      operational: 'Operational',
      degraded: 'Degraded',
      down: 'Down',
      checking: 'Checking...',
      unconfigured: 'Not Configured',
    },
    components: {
      frontend: {
        name: 'Web App (GitHub Pages)',
        desc: 'The React app you are using right now — hosted on GitHub Pages',
      },
      supabase_platform: {
        name: 'Supabase Platform',
        desc: 'Core platform powering the database, authentication and Edge Functions',
      },
      supabase_auth: {
        name: 'Supabase Auth',
        desc: 'Authentication service — manages login, registration and sessions',
      },
      supabase_db: {
        name: 'Supabase Database (PostgreSQL)',
        desc: 'Stores GDPR requests, user profiles, scans and reminders',
      },
      edge_send: {
        name: 'Edge Function: send-request',
        desc: 'Serverless function that sends GDPR deletion emails via Resend API',
      },
      edge_scan: {
        name: 'Edge Function: scan-email',
        desc: 'Serverless function that checks data breaches via HaveIBeenPwned API',
      },
      resend: {
        name: 'Resend Mail API',
        desc: 'External email service — delivers GDPR deletion emails to companies',
      },
      hibp: {
        name: 'XposedOrNot API',
        desc: 'Free external service — checks if an email address appears in known data breaches',
      },
    },
    backHome: '← Home',
  },
} as const

// ─── Status helpers ────────────────────────────────────────────────────────────

function statusColor(s: StatusValue) {
  switch (s) {
    case 'operational':  return 'bg-green-500'
    case 'degraded':     return 'bg-yellow-400'
    case 'down':         return 'bg-red-500'
    case 'unconfigured': return 'bg-gray-300'
    default:             return 'bg-gray-300 animate-pulse'
  }
}

function statusBg(s: StatusValue) {
  switch (s) {
    case 'operational':  return 'bg-green-50 border-green-200'
    case 'degraded':     return 'bg-yellow-50 border-yellow-200'
    case 'down':         return 'bg-red-50 border-red-200'
    case 'unconfigured': return 'bg-gray-50 border-gray-200'
    default:             return 'bg-gray-50 border-gray-200'
  }
}

function overallStatus(results: Record<string, CheckResult>): StatusValue {
  const values = Object.values(results).map((r) => r.status)
  if (values.length === 0) return 'checking'
  if (values.some((s) => s === 'down')) return 'down'
  if (values.some((s) => s === 'degraded')) return 'degraded'
  if (values.every((s) => s === 'operational' || s === 'unconfigured')) return 'operational'
  return 'checking'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Status() {
  const { lang } = useLang()
  const [results, setResults] = useState<Record<string, CheckResult>>({})
  const [running, setRunning] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const t = T[lang]

  const runChecks = useCallback(async () => {
    setRunning(true)
    // Set all to 'checking' while running
    const initial: Record<string, CheckResult> = {}
    COMPONENTS.forEach((c) => { initial[c.id] = { status: 'checking' } })
    setResults(initial)

    // Run all checks in parallel
    const settled = await Promise.allSettled(COMPONENTS.map((c) => c.check()))

    const updated: Record<string, CheckResult> = {}
    COMPONENTS.forEach((c, i) => {
      const r = settled[i]
      updated[c.id] = r.status === 'fulfilled' ? r.value : { status: 'down', detail: 'Check threw' }
    })
    setResults(updated)
    setLastChecked(new Date())
    setRunning(false)
  }, [])

  useEffect(() => {
    runChecks()
    const interval = setInterval(runChecks, 30000)
    return () => clearInterval(interval)
  }, [runChecks])

  const overall = overallStatus(results)

  // Group components by category
  const grouped = (Object.keys(T.sv.categories) as Category[]).map((cat) => ({
    cat,
    components: COMPONENTS.filter((c) => c.category === cat),
  }))

  const overallBg =
    overall === 'operational' ? 'bg-green-600' :
    overall === 'degraded' ? 'bg-yellow-500' :
    overall === 'down' ? 'bg-red-600' : 'bg-gray-400'

  const overallText =
    overall === 'operational' ? t.overall.operational :
    overall === 'degraded' ? t.overall.degraded :
    overall === 'down' ? t.overall.down : t.overall.checking

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`${overallBg} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <a href="/" className="text-white/80 hover:text-white text-sm mb-2 inline-block">
                {t.backHome}
              </a>
              <h1 className="text-3xl font-bold">{t.title}</h1>
              <p className="mt-1 text-white/90 text-sm">{t.subtitle}</p>
            </div>
          </div>

          {/* Overall status banner */}
          <div className="mt-6 bg-white/15 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className={`inline-block w-3 h-3 rounded-full ${overall === 'checking' ? 'bg-white/60 animate-pulse' : 'bg-white'}`} />
              <span className="font-semibold text-lg">{overallText}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/80">
              <span>
                {t.lastChecked}: {lastChecked
                  ? lastChecked.toLocaleTimeString(lang === 'sv' ? 'sv-SE' : 'en-GB')
                  : t.never}
              </span>
              <button
                onClick={runChecks}
                disabled={running}
                className="bg-white/20 hover:bg-white/30 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {running ? t.refreshing : t.refresh}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {grouped.map(({ cat, components }) => {
          if (components.length === 0) return null
          return (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t.categories[cat]}
              </h2>
              <div className="space-y-3">
                {components.map((comp) => {
                  const result = results[comp.id] ?? { status: 'checking' as StatusValue }
                  const compText = t.components[comp.id as keyof typeof t.components]
                  return (
                    <div
                      key={comp.id}
                      className={`rounded-xl border p-4 flex items-center gap-4 transition-colors ${statusBg(result.status)}`}
                    >
                      {/* Status dot */}
                      <span className={`shrink-0 w-3 h-3 rounded-full ${statusColor(result.status)}`} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">
                            {compText?.name ?? comp.id}
                          </span>
                          {comp.docsUrl && (
                            <a
                              href={comp.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              ↗
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{compText?.desc}</p>
                        {result.detail && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{result.detail}</p>
                        )}
                      </div>

                      {/* Right side: status + response time */}
                      <div className="shrink-0 text-right">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            result.status === 'operational'  ? 'bg-green-100 text-green-800' :
                            result.status === 'degraded'     ? 'bg-yellow-100 text-yellow-800' :
                            result.status === 'down'         ? 'bg-red-100 text-red-800' :
                            result.status === 'unconfigured' ? 'bg-gray-100 text-gray-600' :
                                                               'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {t.statusLabel[result.status]}
                        </span>
                        {result.responseTime !== undefined && (
                          <p className="text-xs text-gray-400 mt-1">
                            {result.responseTime} {t.ms}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center pt-4">
          {t.autoRefresh}
        </p>
      </div>
    </div>
  )
}
