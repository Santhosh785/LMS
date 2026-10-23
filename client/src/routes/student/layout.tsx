import ProtectedRoute from '../../components/ProtectedRoute.jsx'
import RouteErrorView from '../../components/RouteErrorView'
import StudentLayout from '../../layouts/StudentLayout.jsx'

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
  return <div className="min-h-screen bg-surface-student" aria-busy="true" />
}

export default function StudentLayoutRoute() {
  return (
    <ProtectedRoute>
      <StudentLayout />
    </ProtectedRoute>
  )
}

/** A broken page keeps the student chrome and navigation. */
export function ErrorBoundary() {
  return (
    <ProtectedRoute>
      <StudentLayout>
        <RouteErrorView scope="student" />
      </StudentLayout>
    </ProtectedRoute>
  )
}
