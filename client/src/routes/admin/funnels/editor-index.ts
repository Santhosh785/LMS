import { replace } from 'react-router'
import type { Route } from './+types/editor-index'

/** The old `<Navigate to="overview" replace />` index route. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url)
  return replace(`${url.pathname.replace(/\/+$/, '')}/overview${url.search}`)
}

export default function RedirectIndex() {
  return null
}
