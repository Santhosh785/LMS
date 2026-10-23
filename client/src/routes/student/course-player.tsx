import ProtectedRoute from '../../components/ProtectedRoute.jsx'
import CoursePlayer from '../../pages/student/CoursePlayer.jsx'

/** Client-only, like the student layout; full-screen, so no layout around it. */

export async function clientLoader() {
  return null
}
clientLoader.hydrate = true as const

/** What the server renders for this route: a header-less, busy block. */
export function HydrateFallback() {
  return <div className="min-h-screen" aria-busy="true" />
}

export default function CoursePlayerRoute() {
  return (
    <ProtectedRoute>
      <CoursePlayer />
    </ProtectedRoute>
  )
}
