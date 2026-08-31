import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { cn, inputClass } from '../ui/index.jsx'

const MENTOR_KEY = 'gs_mentor_popup'
const MENTOR_DELAY_MS = 60_000

const CHIP_GROUPS = [
  {
    name: 'profile',
    label: 'Current Profile',
    values: ['Career Switcher', 'Working Marketer', 'Student', 'Founder'],
  },
  {
    name: 'year',
    label: 'Year of Passing',
    values: ['2026', '2027', '2028', '2029', '2030', 'Earlier'],
  },
  {
    name: 'language',
    label: 'Preferred Language',
    values: ['English', 'Hindi', 'Tamil', 'Telugu'],
  },
]

/**
 * The lead popup from js/main.js. Same rules: fires after 60s, instantly with
 * ?mentor, suppressed for the rest of the session once dismissed or submitted.
 * The only change is that submitting now POSTs to /api/leads.
 */
export default function MentorPopup() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [chips, setChips] = useState({})
  const [error, setError] = useState(null)
  const formRef = useRef(null)
  const [searchParams] = useSearchParams()
  const location = useLocation()

  useEffect(() => {
    if (sessionStorage.getItem(MENTOR_KEY)) return undefined
    const delay = searchParams.has('mentor') ? 0 : MENTOR_DELAY_MS
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem(MENTOR_KEY)) setOpen(true)
    }, delay)
    return () => clearTimeout(timer)
  }, [searchParams])

  const close = (persist = true) => {
    setOpen(false)
    if (persist) sessionStorage.setItem(MENTOR_KEY, 'dismissed')
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && close(true)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const form = formRef.current
    const data = Object.fromEntries(new FormData(form))
    // same client-side rule as before: valid email + non-empty phone
    if (!form.email.checkValidity() || !data.phone?.trim()) {
      form.reportValidity()
      return
    }
    try {
      await api.post('/leads', {
        ...data,
        ...chips,
        source: 'mentor-popup',
        page: location.pathname,
      })
      setDone(true)
      sessionStorage.setItem(MENTOR_KEY, 'submitted')
      setTimeout(() => close(true), 2200)
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not submit right now. Please try again.')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-[rgba(10,18,17,0.55)] p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && close(true)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mentor-popup-title"
    >
      <div className="grid w-full max-w-3xl grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-xl2 bg-white shadow-soft mx-860:grid-cols-1">
        <aside
          className="relative flex flex-col justify-center gap-3 p-8 text-white brand-wash-deep art-sheen mx-860:hidden"
          aria-hidden="true"
        >
          <h2 id="mentor-popup-title" className="text-[1.75rem] text-white">
            Have Questions?
          </h2>
          <p className="text-[1.05rem] font-semibold text-white/95">Talk to a Growth Mentor!</p>
          <p className="text-[0.9rem] leading-relaxed text-white/85">
            Get learner journeys, campaign tips, and Growth Scholar updates — plus a free call to
            map your next skill path.
          </p>
        </aside>

        <div className="relative p-6">
          <button
            type="button"
            onClick={() => close(true)}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-mist hover:text-brand"
          >
            ✕
          </button>

          {done ? (
            <div className="grid h-full place-items-center py-16 text-center">
              <div>
                <h3 className="text-[1.2rem]">You’re booked in</h3>
                <p className="mt-2 text-[0.9rem] text-muted">
                  A growth mentor will reach out shortly. Check your phone for the OTP and
                  confirmation.
                </p>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-3 pt-6">
              <label className="block">
                <span className="mb-1 block text-[0.8rem] font-semibold text-brand-deep">Name</span>
                <input name="name" type="text" autoComplete="name" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.8rem] font-semibold text-brand-deep">
                  Email Address *
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.8rem] font-semibold text-brand-deep">
                  Phone Number
                </span>
                <div className="flex items-stretch overflow-hidden rounded-md2 border border-line">
                  <span
                    className="grid place-items-center bg-surface-mist px-3 text-[0.85rem] text-muted"
                    aria-hidden="true"
                  >
                    🇮🇳 +91
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="Phone Number"
                    required
                    className="w-full border-0 px-3 py-2.5 text-[0.9rem] outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.8rem] font-semibold text-brand-deep">
                  Educational Qualification
                </span>
                <select
                  name="education"
                  defaultValue=""
                  required
                  className={cn(inputClass, 'appearance-none')}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  <option>Undergraduate</option>
                  <option>Graduate</option>
                  <option>Post Graduate</option>
                  <option>Diploma</option>
                  <option>Other</option>
                </select>
              </label>

              {CHIP_GROUPS.map((group) => (
                <div key={group.name}>
                  <span className="mb-1.5 block text-[0.8rem] font-semibold text-brand-deep">
                    {group.label}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setChips((c) => ({ ...c, [group.name]: value }))}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[0.8rem] font-medium transition-colors duration-200 ease-gs',
                          chips[group.name] === value
                            ? 'border-brand bg-accent-soft text-brand'
                            : 'border-line text-muted hover:border-brand hover:text-brand',
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-[0.75rem] text-muted">You'll receive an OTP on this number.</p>
              <p className="text-[0.72rem] leading-relaxed text-muted">
                By continuing, I have read and agreed to Growth Scholar's{' '}
                <Link to="/terms" onClick={() => close(false)} className="text-brand underline">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" onClick={() => close(false)} className="text-brand underline">
                  Privacy Policy
                </Link>
                .
              </p>
              {error && <p className="text-[0.8rem] text-danger">{error}</p>}
              <button
                type="submit"
                className="mt-1 min-h-[46px] rounded-full bg-brand px-5 font-semibold text-white shadow-[0_8px_20px_rgba(19,88,85,0.22)] transition-colors hover:bg-brand-deep"
              >
                Book My Free Call
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
