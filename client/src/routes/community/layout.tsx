import ProtectedRoute from '../../components/ProtectedRoute.jsx'
import RouteErrorView from '../../components/RouteErrorView'
import CommunityLayout from '../../layouts/CommunityLayout.jsx'

/**
 * Client-only area: no server loader, so the server renders only the fallback
 * below and the browser renders the real tree once its client loader has run.
 * The pages inside keep fetching with TanStack Query and axios unchanged.
 */

export async function clientLoader() {
  return null
}
clientLoader.hydrate = true as const

/** What the server renders for this route: a header-less, busy block. */
export function HydrateFallback() {
  return <div className="min-h-screen bg-surface-community" aria-busy="true" />
}

export default function CommunityLayoutRoute() {
  return (
    <ProtectedRoute>
      <CommunityLayout />
    </ProtectedRoute>
  )
}

/** A broken page keeps the community chrome and navigation. */
export function ErrorBoundary() {
  return (
    <ProtectedRoute>
      <CommunityLayout>
        <RouteErrorView scope="community" />
      </CommunityLayout>
    </ProtectedRoute>
  )
}
