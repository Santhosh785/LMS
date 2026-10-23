import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ErrorView } from './ErrorBoundary.jsx'
import NotFound from '../pages/public/NotFound.jsx'
import { reportClientError } from '../lib/observability.js'

/**
 * What a route module's `ErrorBoundary` export renders.
 *
 * A 404 error response is the not-found page; every other error response and
 * every thrown error is the same failure UI the class boundary shows. The
 * router clears the error on the next navigation, which is what the old
 * pathname-keyed boundary did by remounting.
 *
 * Nothing here touches `window` during render — the report goes out from an
 * effect, so the boundary is safe to render on the server.
 */
export default function RouteErrorView({ scope }: { scope: string }) {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const failure = notFound ? null : toError(error)

  useEffect(() => {
    if (failure) reportClientError(failure, { scope })
  }, [failure, scope])

  if (notFound) return <NotFound />
  return <ErrorView error={failure} />
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error
  if (isRouteErrorResponse(error)) {
    return new Error(`${error.status} ${error.statusText || ''}`.trim(), { cause: error.data })
  }
  return new Error(String(error))
}
