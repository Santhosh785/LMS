import { useMemo } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Mirrors the server's requireAuth / requireRole. This is UX only — the API
 * enforces the same rules, so a hand-crafted request cannot slip past it.
 *
 * @param {{ role?: string, children: import('react').ReactNode }} props
 */
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const from = location.pathname
  const redirectState = useMemo(() => ({ from }), [from])

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>
  }

  if (!user) {
    return <Navigate to="/login" state={redirectState} replace />
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />
  }

  return children
}
