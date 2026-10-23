import { replace } from 'react-router'
import type { Route } from './+types/index'

/** The old `<Navigate to="broadcasts" replace />` index route. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url)
  return replace(`${url.pathname.replace(/\/+$/, '')}/broadcasts${url.search}`)
}

export default function RedirectIndex() {
  return null
}
