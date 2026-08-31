import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiError, apiFieldErrors } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, ErrorNote, Loading, TextField } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import BrandLogo from '../../components/BrandLogo.jsx'

/**
 * Serves both halves of the same mechanism: a learner resetting a forgotten
 * password, and a buyer whose account was created for them by the UPI approval
 * choosing their first one. The server does not distinguish the two — only the
 * copy does, keyed on whether the account has ever had a password.
 */
export default function ResetPassword() {
  useDocumentTitle('Choose a password | Growth Scholar')
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const { adoptSession } = useAuth()

  const [checking, setChecking] = useState(true)
  const [account, setAccount] = useState(null)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)

  // Check the link before showing a form — being told "expired" after typing a
  // password twice is the most annoying possible order to learn it.
  useEffect(() => {
    if (!token) {
      setError('This link is missing its token. Request a new one below.')
      setChecking(false)
      return
    }
    let cancelled = false
    api
      .get(`/auth/reset-password/${encodeURIComponent(token)}`)
      .then((res) => !cancelled && setAccount(res.data))
      .catch((err) => !cancelled && setError(apiError(err)))
      .finally(() => !cancelled && setChecking(false))
    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFields({})
    const data = Object.fromEntries(new FormData(e.currentTarget))

    if (data.password !== data.confirm) {
      setFields({ confirm: 'Both passwords must match' })
      return
    }

    setBusy(true)
    try {
      const res = await api.post('/auth/reset-password', { token, password: data.password })
      // The server signs them in as part of the reset, so go straight to the
      // course rather than bouncing through a login form they just proved.
      adoptSession(res.data.user)
      navigate(res.data.user?.role === 'admin' ? '/admin' : '/student', { replace: true })
    } catch (err) {
      setError(apiError(err))
      setFields(apiFieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-76px)] place-items-center px-5 py-16">
      <div className="w-full max-w-md rounded-xl2 border border-line bg-white p-8 shadow-soft mx-560:p-6">
        <BrandLogo width={140} height={88} className="mb-5 h-11 w-auto rounded-sm2" />

        {checking ? (
          <Loading label="Checking your link…" />
        ) : !account ? (
          <>
            <h1 className="text-[1.5rem]">This link no longer works</h1>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
              Reset links can be used once and expire. Request a fresh one and it will arrive in a
              moment.
            </p>
            <ErrorNote error={error} />
            <Button to="/forgot-password" block className="mt-6">
              Send me a new link
            </Button>
            <p className="mt-5 text-center text-[0.88rem] text-muted">
              <Link to="/login" className="font-semibold text-brand hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[1.5rem]">Choose a password</h1>
            <p className="mt-1 break-words text-[0.9rem] text-muted">
              For <span className="font-semibold text-brand-deep">{account.email}</span>
            </p>

            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              <TextField
                name="password"
                type="password"
                label="New password"
                autoComplete="new-password"
                hint="At least 8 characters"
                minLength={8}
                autoFocus
                required
                error={fields.password}
              />
              <TextField
                name="confirm"
                type="password"
                label="Confirm password"
                autoComplete="new-password"
                minLength={8}
                required
                error={fields.confirm}
              />
              <ErrorNote error={error} />
              <Button type="submit" block disabled={busy}>
                {busy ? 'Saving…' : 'Save password and sign in'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
