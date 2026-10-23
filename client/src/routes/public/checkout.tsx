import Checkout from '../../pages/public/Checkout.jsx'

/**
 * Client-only: the public chrome around it is server-rendered, the checkout
 * body itself (TanStack Query + axios, the payment SDK) renders in the browser.
 */

export async function clientLoader() {
  return null
}
clientLoader.hydrate = true as const

/** What the server renders for this route: a header-less, busy block. */
export function HydrateFallback() {
  return <div className="min-h-[60vh]" aria-busy="true" />
}

export default Checkout
