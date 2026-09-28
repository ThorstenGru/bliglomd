// Breach checking runs entirely client-side against XposedOrNot's free, keyless,
// CORS-enabled endpoints -- deliberately NOT proxied through our own backend.
//
// XposedOrNot's `breach-analytics` endpoint (what a backend proxy would naturally
// reach for) sits behind Cloudflare bot-protection that blocks any cloud/datacenter
// IP range, including Supabase's -- so a server-side call to it fails 100% of the
// time in production, regardless of retries. `check-email` and `breaches` are
// different endpoints that DO send CORS headers and are NOT behind that same
// bot-check, so a real browser calling them directly (a normal residential/mobile
// IP, not a datacenter one) works reliably. This also means no paid tier is needed.
//
// `check-email/{email}` returns just the breach names an email appears in.
// `breaches` returns the full breach catalog (dates, domains, exposed data types,
// record counts) -- fetched once and cached, then joined against the name list to
// reconstruct the same level of detail the UI shows.

export interface XonBreach {
  breach: string
  xposed_date: string
  domain: string
  industry: string
  xposed_data: string
  xposed_records: number
}

export interface BreachCheckResult {
  breaches: XonBreach[]
  unavailable: boolean
}

interface CatalogEntry {
  breachID: string
  breachedDate?: string
  domain?: string
  industry?: string
  exposedData?: string[]
  exposedRecords?: number
}

let catalogPromise: Promise<Map<string, CatalogEntry>> | null = null

function fetchCatalog(): Promise<Map<string, CatalogEntry>> {
  if (!catalogPromise) {
    catalogPromise = fetch('https://api.xposedornot.com/v1/breaches', { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalog ${r.status}`))))
      .then((d) => {
        const map = new Map<string, CatalogEntry>()
        for (const entry of (d?.exposedBreaches ?? []) as CatalogEntry[]) {
          map.set(entry.breachID, entry)
        }
        return map
      })
      .catch((err) => {
        catalogPromise = null // allow a retry on the next scan instead of caching a failure forever
        throw err
      })
  }
  return catalogPromise
}

export async function checkEmailBreaches(email: string): Promise<BreachCheckResult> {
  try {
    const [checkRes, catalog] = await Promise.all([
      fetch(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
      fetchCatalog(),
    ])

    if (!checkRes.ok) return { breaches: [], unavailable: true }

    const data = await checkRes.json()
    const names: string[] = Array.isArray(data?.breaches?.[0]) ? data.breaches[0] : []

    const breaches: XonBreach[] = names.map((name) => {
      const info = catalog.get(name)
      return {
        breach: name,
        xposed_date: info?.breachedDate?.slice(0, 10) ?? '',
        domain: info?.domain ?? '',
        industry: info?.industry ?? '',
        xposed_data: Array.isArray(info?.exposedData) ? info.exposedData.join(', ') : '',
        xposed_records: typeof info?.exposedRecords === 'number' ? info.exposedRecords : 0,
      }
    })

    return { breaches, unavailable: false }
  } catch (err) {
    console.error('Breach check failed:', err)
    return { breaches: [], unavailable: true }
  }
}
