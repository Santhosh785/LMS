import { replace } from 'react-router'
import type { Route } from './+types/course-editor-index'

/** The old `<Navigate to="information" replace />` index route. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url)
  return replace(`${url.pathname.replace(/\/+$/, '')}/information${url.search}`)
}

export default function RedirectIndex() {
  return null
}
