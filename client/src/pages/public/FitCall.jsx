import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { cn } from '../../components/ui/index.jsx'
import { countWords } from '../../data/applyForm.js'

/**
 * /programs/fit-call — the 15-minute call that precedes an admission decision,
 * new in the 2026 redesign (.pa-page--fit).
 *
 * A single-screen form rather than the application's wizard, so the fields are
 * declared inline. POST /api/fit-calls re-checks everything enforced here.
 */

const SLOTS = [
  { value: 'mon-fri-10-12', label: 'Mon–Fri 10–12' },
  { value: 'mon-fri-12-3', label: 'Mon–Fri 12–3' },
  { value: 'mon-fri-7-10', label: 'Mon–Fri 7–10 PM' },
  { value: 'sat-10-1', label: 'Sat 10–1' },
  { value: 'sat-2-6', label: 'Sat 2–6' },
  { value: 'sun-10-1', label: 'Sun 10–1' },
]

const WHY_MAX_WORDS = 80

const SELECTS = {
  preferredWeek: ['This week', 'Next week', 'Within 2 weeks', 'After a specific date — note below'],
  currentStatus: ['Student', 'Working professional', 'Freelancer', 'Founder', 'Job seeking'],
  weeklyHours: ['10–12 (recommended)', '8–10', '12+', 'Under 8 — discuss on call'],
  biggestBlocker: [
    'Schedule / job hours',
    'Fee / scholarship',
    'Not sure program is right fit',
    'Need employer approval',
    'Travel for masterclass',
    'Other',
  ],
}

const REQUIRED = [
  ['fullName', 'Your name is required'],
  ['email', 'Enter a valid email'],
  ['phone', 'A WhatsApp number is required'],
  ['callLanguage', 'Pick a language'],
  ['submittedFullApplication', 'Tell us where your application stands'],
  ['preferredWeek', 'Pick a date range'],
  ['currentStatus', 'Pick your current role'],
  ['weeklyHours', 'Pick your realistic weekly hours'],
  ['biggestBlocker', 'Pick your biggest blocker'],
  ['referralSource', 'Tell us how you heard about us'],
  ['callQuestions', 'Give us your questions so we can prepare'],
]

/** A labelled <select> backed by SELECTS; hoisted so it is a stable component. */
function Sel({ name, label, value, error, onChange }) {
  return (
    <div className="pa-field">
      <label htmlFor={name}>{label}</label>
      <select id={name} value={value || ''} onChange={(e) => onChange(name, e.target.value)}>
        <option value="">Select</option>
        {SELECTS[name].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {error && <span className="pa-error">{error}</span>}
    </div>
  )
}

export default function FitCall() {
  const [v, setV] = useState({ preferredSlots: [], timezone: '' })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')

  const set = (name, value) => {
    setV((s) => ({ ...s, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e))
  }

  const submit = useMutation({
    mutationFn: async (payload) => (await api.post('/fit-calls', payload)).data,
    onError: (err) => setSubmitError(apiError(err)),
  })

  const onSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    const found = {}
    for (const [name, message] of REQUIRED) {
      if (!String(v[name] || '').trim()) found[name] = message
    }
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) found.email = 'Enter a valid email'
    if (!v.preferredSlots.length) found.preferredSlots = 'Pick at least one slot'
    if (v.consent !== true) found.consent = 'Required to book a call'
    if (countWords(v.whyCallNow) > WHY_MAX_WORDS)
      found.whyCallNow = `Keep this under ${WHY_MAX_WORDS} words`

    if (Object.keys(found).length) {
      setErrors(found)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    submit.mutate({ ...v, page: '/programs/fit-call' })
  }

  if (submit.isSuccess) {
    return (
      <div className="pa-page pa-page--fit">
        <main className="pa-shell">
          <div className="pa-success">
            <h2>Fit call requested</h2>
            <p>
              Thanks — we’ll send a scheduling link on WhatsApp or email, usually within 5 business
              days. A fit call does not reserve a seat; admission follows the full application.
            </p>
            <Link className="pa-btn pa-btn-primary" to="/programs/apply">
              Apply in full
            </Link>
            <Link
              className="pa-btn pa-btn-secondary"
              to="/programs/complete-growth-marketing"
              style={{ marginLeft: '0.5rem' }}
            >
              Back to program
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="pa-page pa-page--fit">
      <main className="pa-shell">
        <div className="pa-top">
          <p className="pa-breadcrumb">
            <Link to="/">Home</Link> →{' '}
            <Link to="/programs/complete-growth-marketing">Flagship</Link> → Fit call
          </p>
          <h1>Book your 15-min fit call</h1>
          <p className="lede">
            A short conversation to check motivation, weekly schedule, and language fit before we
            hold a seat. Not a sales pitch — we’ll tell you if self-paced or a workshop is a better
            next step.
          </p>
          <div className="pa-meta-pills">
            <span>15 minutes · Zoom/WhatsApp</span>
            <span>Usually within 5 business days</span>
            <span>IST time slots</span>
          </div>
        </div>

        <div className="pa-layout">
          <div className="pa-form-card">
            <form onSubmit={onSubmit} noValidate>
              <div className="pa-panel is-active" style={{ display: 'block' }}>
                <div className="pa-panel-head">
                  <h2>Your details</h2>
                  <p>Use the same email/phone as your application if you already applied.</p>
                </div>

                <fieldset className="pa-fieldset">
                  <legend>Contact</legend>
                  <div className="pa-grid">
                    {[
                      { name: 'fullName', label: 'Full name', type: 'text', ac: 'name' },
                      { name: 'email', label: 'Email', type: 'email', ac: 'email' },
                      {
                        name: 'phone',
                        label: 'WhatsApp number',
                        type: 'tel',
                        ac: 'tel',
                        ph: '+91 …',
                      },
                    ].map((f) => (
                      <div className="pa-field" key={f.name}>
                        <label htmlFor={f.name}>{f.label}</label>
                        <input
                          id={f.name}
                          type={f.type}
                          autoComplete={f.ac}
                          placeholder={f.ph}
                          value={v[f.name] || ''}
                          onChange={(e) => set(f.name, e.target.value)}
                        />
                        {errors[f.name] && <span className="pa-error">{errors[f.name]}</span>}
                      </div>
                    ))}
                    <div className="pa-field">
                      <label htmlFor="callLanguage">Language for the call</label>
                      <select
                        id="callLanguage"
                        value={v.callLanguage || ''}
                        onChange={(e) => set('callLanguage', e.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="tamil">Tamil</option>
                      </select>
                      {errors.callLanguage && (
                        <span className="pa-error">{errors.callLanguage}</span>
                      )}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="pa-fieldset">
                  <legend>Application status</legend>
                  <div className="pa-field span-2">
                    <div className="pa-radio-row">
                      {[
                        { value: 'yes', label: 'Yes — submitted on apply page' },
                        { value: 'in-progress', label: 'In progress — booking call to decide' },
                        { value: 'no', label: 'Not yet' },
                      ].map((o) => (
                        <label key={o.value}>
                          <input
                            type="radio"
                            name="submittedFullApplication"
                            checked={v.submittedFullApplication === o.value}
                            onChange={() => set('submittedFullApplication', o.value)}
                          />{' '}
                          {o.label}
                        </label>
                      ))}
                    </div>
                    {errors.submittedFullApplication && (
                      <span className="pa-error">{errors.submittedFullApplication}</span>
                    )}
                  </div>
                  <div className="pa-field span-2">
                    <label htmlFor="whyCallNow">
                      In 2–3 sentences, why Flagship LIVE and why a call now?
                    </label>
                    <textarea
                      id="whyCallNow"
                      value={v.whyCallNow || ''}
                      onChange={(e) => set('whyCallNow', e.target.value)}
                    />
                    <span
                      className={cn(
                        'pa-word-count',
                        countWords(v.whyCallNow) > WHY_MAX_WORDS && 'is-over',
                      )}
                    >
                      {countWords(v.whyCallNow)} / {WHY_MAX_WORDS} words
                    </span>
                    {errors.whyCallNow && <span className="pa-error">{errors.whyCallNow}</span>}
                  </div>
                </fieldset>

                <fieldset className="pa-fieldset">
                  <legend>Schedule preference (IST)</legend>
                  <div className="pa-grid full">
                    <Sel
                      name="preferredWeek"
                      label="Preferred date range"
                      value={v.preferredWeek}
                      error={errors.preferredWeek}
                      onChange={set}
                    />
                    <div className="pa-field">
                      <label htmlFor="timezone">If outside India, your timezone</label>
                      <input
                        id="timezone"
                        type="text"
                        placeholder="Optional — e.g. GST, EST"
                        value={v.timezone}
                        onChange={(e) => set('timezone', e.target.value)}
                      />
                    </div>
                    <div className="pa-field span-2">
                      <span className="label">Slots that work for you</span>
                      <div className="pa-check-grid">
                        {SLOTS.map((s) => (
                          <label key={s.value}>
                            <input
                              type="checkbox"
                              checked={v.preferredSlots.includes(s.value)}
                              onChange={(e) =>
                                set(
                                  'preferredSlots',
                                  e.target.checked
                                    ? [...v.preferredSlots, s.value]
                                    : v.preferredSlots.filter((x) => x !== s.value),
                                )
                              }
                            />{' '}
                            {s.label}
                          </label>
                        ))}
                      </div>
                      {errors.preferredSlots && (
                        <span className="pa-error">{errors.preferredSlots}</span>
                      )}
                    </div>
                    <div className="pa-field span-2">
                      <label htmlFor="scheduleNotes">Blackout times or “only after date X”</label>
                      <textarea
                        id="scheduleNotes"
                        rows={2}
                        placeholder="Optional"
                        value={v.scheduleNotes || ''}
                        onChange={(e) => set('scheduleNotes', e.target.value)}
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="pa-fieldset">
                  <legend>Fit questions</legend>
                  <div className="pa-grid full">
                    <Sel
                      name="currentStatus"
                      label="Current role"
                      value={v.currentStatus}
                      error={errors.currentStatus}
                      onChange={set}
                    />
                    <Sel
                      name="weeklyHours"
                      label="Realistic weekly hours for Flagship"
                      value={v.weeklyHours}
                      error={errors.weeklyHours}
                      onChange={set}
                    />
                    <Sel
                      name="biggestBlocker"
                      label="Biggest blocker to joining?"
                      value={v.biggestBlocker}
                      error={errors.biggestBlocker}
                      onChange={set}
                    />
                    <div className="pa-field">
                      <label htmlFor="referralSource">How did you hear about us?</label>
                      <input
                        id="referralSource"
                        type="text"
                        placeholder="Be specific — helps us prepare"
                        value={v.referralSource || ''}
                        onChange={(e) => set('referralSource', e.target.value)}
                      />
                      {errors.referralSource && (
                        <span className="pa-error">{errors.referralSource}</span>
                      )}
                    </div>
                    <div className="pa-field span-2">
                      <label htmlFor="callQuestions">
                        Top 3 questions you want answered on the call
                      </label>
                      <textarea
                        id="callQuestions"
                        rows={4}
                        placeholder={'1. …\n2. …\n3. …'}
                        value={v.callQuestions || ''}
                        onChange={(e) => set('callQuestions', e.target.value)}
                      />
                      {errors.callQuestions && (
                        <span className="pa-error">{errors.callQuestions}</span>
                      )}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="pa-fieldset">
                  <legend>Consent</legend>
                  <div className="pa-field span-2">
                    <label>
                      <input
                        type="checkbox"
                        checked={v.consent === true}
                        onChange={(e) => set('consent', e.target.checked)}
                      />{' '}
                      I agree to receive scheduling links on WhatsApp/email and understand this is
                      not a guaranteed admission.
                    </label>
                    {errors.consent && <span className="pa-error">{errors.consent}</span>}
                  </div>
                </fieldset>
              </div>

              {submitError && (
                <p className="pa-error" role="alert">
                  {submitError}
                </p>
              )}

              <div className="pa-nav">
                <button className="pa-btn pa-btn-primary" type="submit" disabled={submit.isPending}>
                  {submit.isPending ? 'Requesting…' : 'Request fit call'}
                </button>
              </div>
            </form>
          </div>

          <aside className="pa-aside">
            <h2>On the call we cover</h2>
            <ul className="prog-trust-mini" style={{ marginBottom: '1rem' }}>
              <li>Your 12-week outcome &amp; current baseline</li>
              <li>10–12 hr/week reality check</li>
              <li>Offline masterclass travel &amp; live IST slots</li>
              <li>Fee and scholarship process</li>
              <li>Whether self-paced or workshop fits better</li>
            </ul>
            <p className="pa-aside-note">
              <strong>Seats are limited:</strong> 10 per batch. A fit call does not reserve one —
              admission follows review of the full application.
            </p>
            <p className="pa-aside-note">
              <Link to="/programs/apply">Apply in full →</Link>
            </p>
          </aside>
        </div>
      </main>
    </div>
  )
}
