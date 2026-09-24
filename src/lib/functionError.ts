import type { FunctionsError } from '@supabase/supabase-js'

/**
 * supabase-js's functions.invoke() error.message is a generic wrapper
 * ("Edge Function returned a non-2xx status code") — the actual reason lives
 * in the response body, reachable via error.context (the raw Response).
 * This pulls that real message out so users (and error logs) see e.g.
 * "Ghost subscription required" instead of the opaque wrapper text.
 */
export async function extractFunctionErrorMessage(error: FunctionsError): Promise<string> {
  const context = (error as { context?: unknown }).context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json()
      if (typeof body?.error === 'string') return body.error
    } catch {
      // body wasn't JSON — fall through to the generic message
    }
  }
  return error.message
}
