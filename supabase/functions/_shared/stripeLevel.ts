// Shared between stripe-webhook and stripe-checkout so they can never silently
// disagree on how a Stripe price maps to a BliGlömd tier level -- previously
// duplicated byte-for-byte in both files, a real drift risk since Supabase Edge
// Functions deploy independently and nothing enforced the two copies staying in sync.
export const STRIPE_BASE = 'https://api.stripe.com/v1'

export async function levelFromPrice(priceId: string, stripeAuth: string): Promise<number | null> {
  const res = await fetch(`${STRIPE_BASE}/prices/${priceId}?expand[]=product`, {
    headers: { Authorization: stripeAuth },
  })
  const price = await res.json()
  const raw = price.product?.metadata?.bliglomd_level
  return raw ? parseInt(raw, 10) : null
}
