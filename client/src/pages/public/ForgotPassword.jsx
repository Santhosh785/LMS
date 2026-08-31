import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError, apiFieldErrors } from '../../api/client.js'
import { Button, ErrorNote, TextField } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import BrandLogo from '../../components/BrandLogo.jsx'

export default function ForgotPassword() {
  useDocumentTitle('Reset your password | Growth Scholar')
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFields({})
    setBusy(true)
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await api.post('/auth/forgot-password', { email: data.email })
      setSent(true)
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

        {sent ? (
          <>
            <h1 className="text-[1.5rem]">Check your email</h1>
            {/*
              Deliberately says "if that email has an account". The server
              answers identically either way — telling the visitor here which
              case they are in would hand back the account enumeration the
              endpoint is careful not to leak.
            */}
            <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
              If that email has an account, a reset link is on its way. It works once and expires in
              an hour.
            </p>
            <p className="mt-4 text-[0.85rem] text-muted">
              Nothing arrived? Check spam, then{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="font-semibold text-brand hover:underline"
              >
                try another address
              </button>
              .
            </p>
            <Button to="/login" variant="outline" block className="mt-6">
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-[1.5rem]">Forgot your password?</h1>
            <p className="mt-1 text-[0.9rem] text-muted">
              Enter the email you signed up with and we&rsquo;ll send you a link to set a new one.
            </p>

            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              <TextField
                name="email"
                type="email"
                label="Email"
                autoComplete="email"
                inputMode="email"
                autoFocus
                required
                error={fields.email}
              />
              <ErrorNote error={error} />
              <Button type="submit" block disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <p className="mt-5 text-center text-[0.88rem] text-muted">
              Remembered it?{' '}
              <Link to="/login" className="font-semibold text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
