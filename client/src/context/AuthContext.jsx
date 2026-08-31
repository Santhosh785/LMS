import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

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
