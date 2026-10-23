import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { cn } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import { APPLY_STEPS, VISIBILITY, countWords, visibleFields } from '../../data/applyForm.js'

/**
 * /programs/apply — the Flagship application (.pa-page), new in the 2026
 * redesign.
 *
 * Five steps, a draft kept in this browser, conditional blocks for
 * experienced/beginner/scholarship, word-limited essays, and a review screen.
 * Every rule enforced here is enforced again in POST /api/applications: this
 * copy is for the applicant's benefit, not a control.
 */

const STORAGE_KEY = 'gs-flagship-apply-draft'

const CHECKBOX_TYPES = new Set(['checkboxes'])

/** Only the answers a field can hold — never the step index or scratch state. */
function loadDraft() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    // A corrupt or unavailable store must not stop someone applying.
    return {}
  }
}

/**
 * Validates one step. Returns a map of field name → message; empty means the
 * applicant can continue.
 */
function validateStep(step, values) {
  const errors = {}
  for (const f of visibleFields(step, values)) {
    const value = values[f.name]

    if (CHECKBOX_TYPES.has(f.type)) {
      if (f.requireOne && !(value || []).length) errors[f.name] = 'Pick at least one'
      continue
    }
    if (f.type === 'consent') {
      if (f.required && value !== true) errors[f.name] = 'Required to submit'
      continue
    }
    if (f.required && !String(value || '').trim()) {
      errors[f.name] = 'This answer is required'
      continue
    }
    if (f.pattern && value && !f.pattern.test(String(value).trim())) {
      errors[f.name] = f.patternMessage || 'Check this answer'
      continue
    }
    if (f.maxWords && countWords(value) > f.maxWords) {
      errors[f.name] = `Keep this under ${f.maxWords} words`
    }
  }
  return errors
}

function Field({ field, value, error, onChange }) {
  const id = field.name
  const cls = cn('pa-field', field.span === 2 && 'span-2')

  if (field.type === 'consent') {
    return (
      <div className={cls}>
        <label>
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(field.name, e.target.checked)}
          />{' '}
          {field.label}
        </label>
        {error && <span className="pa-error">{error}</span>}
      </div>
    )
  }

  if (field.type === 'checkboxes') {
    const selected = value || []
    return (
      <div className={cn(cls, 'span-2')}>
        {field.label && <span className="label">{field.label}</span>}
        <div className="pa-check-grid">
          {field.options.map((o) => (
            <label key={o.value}>
              <input
                type="checkbox"
                value={o.value}
                checked={selected.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    field.name,
                    e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((v) => v !== o.value),
                  )
                }
              />{' '}
              {o.label}
            </label>
          ))}
        </div>
        {error && <span className="pa-error">{error}</span>}
      </div>
    )
  }

  if (field.type === 'radio') {
    return (
      <div className={cls}>
        {field.label && <span className="label">{field.label}</span>}
        <div className="pa-radio-row">
          {field.options.map((o) => (
            <label key={o.value}>
              <input
                type="radio"
                name={field.name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(field.name, o.value)}
              />{' '}
              {o.label}
            </label>
          ))}
        </div>
        {error && <span className="pa-error">{error}</span>}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className={cls}>
        {field.label && <label htmlFor={id}>{field.label}</label>}
        <select id={id} value={value || ''} onChange={(e) => onChange(field.name, e.target.value)}>
          <option value="">{field.placeholder || 'Select'}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.hint && <span className="hint">{field.hint}</span>}
        {error && <span className="pa-error">{error}</span>}
      </div>
    )
  }

  if (field.type === 'textarea') {
    const words = countWords(value)
    return (
      <div className={cls}>
        <label htmlFor={id}>{field.label}</label>
        <textarea
          id={id}
          rows={field.rows}
          value={value || ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
        {field.maxWords && (
          <span className={cn('pa-word-count', words > field.maxWords && 'is-over')}>
            {words} / {field.maxWords} words
          </span>
        )}
        {error && <span className="pa-error">{error}</span>}
      </div>
    )
  }

  return (
    <div className={cls}>
      <label htmlFor={id}>{field.label}</label>
      <input
        id={id}
        type={field.type}
        value={value || ''}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
      {field.hint && <span className="hint">{field.hint}</span>}
      {error && <span className="pa-error">{error}</span>}
    </div>
  )
}

/** The step-5 summary: every answered, currently-visible question. */
function Review({ values, onJump }) {
  return (
    <div className="pa-review">
      {APPLY_STEPS.filter((s) => !s.review).map((step, i) => {
        const rows = visibleFields(step, values)
          .filter((f) => f.type !== 'consent')
          .map((f) => {
            const v = values[f.name]
            const text = Array.isArray(v)
              ? v.map((x) => f.options?.find((o) => o.value === x)?.label || x).join(', ')
              : f.options?.find((o) => o.value === v)?.label || v
            return { label: f.label || f.name, text }
          })
          .filter((r) => r.text)

        return (
          <section key={step.key}>
            <h3>
              {step.title}
              <button type="button" onClick={() => onJump(i)}>
                Edit
              </button>
            </h3>
            <dl>
              {rows.map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}

export default function Apply() {
  useDocumentTitle('Apply for the Flagship cohort | Growth Scholar')
  useBodyClass('gs-redesign pa-page')
  const [values, setValues] = useState(loadDraft)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')

  const step = APPLY_STEPS[stepIndex]
  const isLast = stepIndex === APPLY_STEPS.length - 1

  // Draft survives a refresh, as the drop's "Draft saved in this browser" promises.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    } catch {
      // Private mode or a full quota — the form still works, just without a draft.
    }
  }, [values])

  const submit = useMutation({
    mutationFn: async (payload) => (await api.post('/applications', payload)).data,
    onSuccess: () => {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Nothing to clean up if the store was never writable.
      }
    },
    onError: (err) => setSubmitError(apiError(err)),
  })

  const setField = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e))
  }

  const go = (next) => {
    setStepIndex(next)
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onNext = () => {
    const found = validateStep(step, values)
    if (Object.keys(found).length) return setErrors(found)
    return go(Math.min(stepIndex + 1, APPLY_STEPS.length - 1))
  }

  const doSubmit = () => {
    setSubmitError('')
    // Re-check every step, not just the last — someone can jump back, clear a
    // required answer, and return to Review without passing through Continue.
    for (let i = 0; i < APPLY_STEPS.length; i += 1) {
      const found = validateStep(APPLY_STEPS[i], values)
      if (Object.keys(found).length) {
        setErrors(found)
        return go(i)
      }
    }
    return submit.mutate({ ...values, page: '/programs/apply' })
  }

  /**
   * One button drives both actions and never changes its `type`.
   *
   * Rendering Continue as type="button" and Submit as type="submit" looks
   * equivalent, but React reconciles them as the same DOM node: advancing to
   * the last step rewrites `type` to "submit" while the browser is still
   * processing that very click, so it fires the form's default action and the
   * application posts without the applicant ever seeing the review screen.
   */
  const onSubmit = (e) => {
    e.preventDefault()
    if (isLast) doSubmit()
    else onNext()
  }

  const progress = useMemo(
    () => `${Math.round(((stepIndex + 1) / APPLY_STEPS.length) * 100)}%`,
    [stepIndex],
  )

  if (submit.isSuccess) {
    return (
      <div className="pa-page">
        <main className="pa-shell">
          <div className="pa-success">
            <h2>Application received</h2>
            <p>
              Thank you — we’ve recorded your application. Expect email/WhatsApp within 7 days.
              Shortlisted applicants get a 15-min fit call link.
            </p>
            <Link className="pa-btn pa-btn-primary" to="/programs/complete-growth-marketing">
              Back to program
            </Link>
            <Link
              className="pa-btn pa-btn-secondary"
              to="/programs/fit-call"
              style={{ marginLeft: '0.5rem' }}
            >
              Book fit call now
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="pa-page">
      <main className="pa-shell">
        <div className="pa-top">
          <p className="pa-breadcrumb">
            <Link to="/">Home</Link> →{' '}
            <Link to="/programs/complete-growth-marketing">Flagship</Link> → Apply
          </p>
          <h1>Apply for the Flagship cohort</h1>
          <p className="lede">
            Complete Growth Marketing · 12 weeks (owners) or 14 weeks (freelancers) · 10 seats. This
            application covers track fit, schedule, and scholarship requests. No payment until
            you’re accepted.
          </p>
          <div className="pa-meta-pills">
            <span>~20 min to complete</span>
            <span>Response in ~7 days</span>
            <span>Draft saved in this browser</span>
          </div>
        </div>

        <div className="pa-layout">
          <aside className="pa-aside" aria-label="Application progress">
            <h2>Your application</h2>
            <ol className="pa-steps">
              {APPLY_STEPS.map((s, i) => (
                <li
                  key={s.key}
                  className={cn(i === stepIndex && 'is-active', i < stepIndex && 'is-done')}
                >
                  <span className="num">{i + 1}</span>
                  <span className="label-text">{s.nav}</span>
                </li>
              ))}
            </ol>
            <p className="pa-aside-note">
              Prefer to talk first? <Link to="/programs/fit-call">Book a 15-min fit call</Link> —
              we’ll still ask for most of this before admission.
            </p>
          </aside>

          <div className="pa-form-card">
            <div className="pa-progress" aria-hidden="true">
              <div className="pa-progress-bar" style={{ width: progress }} />
            </div>

            <form onSubmit={onSubmit} noValidate>
              <div className="pa-panel is-active">
                <div className="pa-panel-head">
                  <h2>{step.title}</h2>
                  <p>{step.intro}</p>
                </div>

                {step.review ? (
                  <Review values={values} onJump={go} />
                ) : (
                  step.fieldsets
                    .filter((fs) => !fs.showWhen || VISIBILITY[fs.showWhen](values))
                    .map((fs) => (
                      <fieldset className="pa-fieldset" key={fs.legend}>
                        <legend>{fs.legend}</legend>
                        <div className={cn('pa-grid', fs.full && 'full')}>
                          {fs.fields.map((f) => (
                            <Field
                              key={f.name}
                              field={f}
                              value={values[f.name]}
                              error={errors[f.name]}
                              onChange={setField}
                            />
                          ))}
                        </div>
                      </fieldset>
                    ))
                )}
              </div>

              {submitError && (
                <p className="pa-error" role="alert">
                  {submitError}
                </p>
              )}

              <div className="pa-nav">
                {stepIndex > 0 && (
                  <button
                    className="pa-btn pa-btn-secondary"
                    type="button"
                    onClick={() => go(stepIndex - 1)}
                  >
                    Back
                  </button>
                )}
                <button className="pa-btn pa-btn-primary" type="submit" disabled={submit.isPending}>
                  {isLast ? (submit.isPending ? 'Submitting…' : 'Submit application') : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
