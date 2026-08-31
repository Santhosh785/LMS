import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { apiError, apiFieldErrors } from '../../api/client.js'
import { Button, ErrorNote, SelectField, TextField } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import BrandLogo from '../../components/BrandLogo.jsx'

export default function Signup() {
  useDocumentTitle('Create your account | Growth Scholar')
  const { register } = useAuth()
  const navigate = useNavigate()
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
      await register(data)
      navigate('/student', { replace: true })
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
        <h1 className="text-[1.5rem]">Start learning free</h1>
        <p className="mt-1 text-[0.9rem] text-muted">
          Native-language courses in SEO, ads, copy and funnels.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <TextField
            name="name"
            label="Full name"
            autoComplete="name"
            required
            error={fields.name}
          />
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
            autoComplete="new-password"
            required
            hint="At least 8 characters"
            error={fields.password}
          />
          <TextField name="phone" type="tel" label="Phone (optional)" autoComplete="tel" />
          <SelectField
            name="preferredLanguage"
            label="Preferred language"
            defaultValue="Tamil"
            options={['Tamil', 'English', 'Hindi', 'Telugu']}
          />
          <ErrorNote error={error} />
          <Button type="submit" block disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-[0.88rem] text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
