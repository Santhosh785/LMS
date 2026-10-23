import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

const AuthContext = createContext(null)

/**
 * @param {{ children: import('react').ReactNode, initialUser?: object | null }} props
 *   `initialUser` is the session the server resolved for this request: a user,
 *   or `null` for a known "nobody is signed in". Either value skips the
 *   /auth/me boot fetch and starts with `loading: false`; only an unspecified
 *   initial value (`undefined`) keeps the old loading boot path.
 */
export function AuthProvider({ children, initialUser }) {
  const known = initialUser !== undefined
  const [user, setUser] = useState(known ? initialUser : null)
  const [loading, setLoading] = useState(!known)

  useEffect(() => {
    if (known) return
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [known])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthed: !!user,
      isAdmin: user?.role === 'admin',
      async login(email, password) {
        const res = await api.post('/auth/login', { email, password })
        setUser(res.data.user)
        return res.data.user
      },
      async register(payload) {
        const res = await api.post('/auth/register', payload)
        setUser(res.data.user)
        return res.data.user
      },
      async logout() {
        await api.post('/auth/logout')
        setUser(null)
      },
      /**
       * Adopts a session the server just opened through some route other than
       * login — today that is the reset-password page, which signs the visitor
       * in the moment they choose a new password.
       */
      adoptSession(nextUser) {
        setUser(nextUser)
        return nextUser
      },
      async updateProfile(patch) {
        const res = await api.patch('/auth/me', patch)
        setUser(res.data.user)
        return res.data.user
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
