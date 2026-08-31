import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { apiError, apiFieldErrors } from '../../api/client.js'
import { Button, ErrorNote, TextField } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import BrandLogo from '../../components/BrandLogo.jsx'

export default function Login() {
  useDocumentTitle('Sign in | Growth Scholar')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFields({})
    setBusy(true)
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      const user = await login(data.email, data.password)
      const to = location.state?.from || (user.role === 'admin' ? '/admin' : '/student')
      navigate(to, { replace: true })
    } catch (err) {
      setError(apiError(err))
      setFields(apiFieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-76px)] place-items-center px-5 py-16">
      <div className="w-full max-w-md rounded-xl2 border border-line bg-white p-8 shadow-soft">
        <BrandLogo width={140} height={88} className="mb-5 h-11 w-auto rounded-sm2" />
        <h1 className="text-[1.5rem]">Welcome back</h1>
        <p className="mt-1 text-[0.9rem] text-muted">Sign in to continue learning.</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <TextField
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            error={fields.email}
          />
          <TextField
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            required
            error={fields.password}
          />
          <ErrorNote error={error} />
          <Button type="submit" block disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-[0.85rem]">
          <Link to="/forgot-password" className="text-muted hover:text-brand hover:underline">
            Forgot your password?
          </Link>
        </p>

        <p className="mt-3 text-center text-[0.88rem] text-muted">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
