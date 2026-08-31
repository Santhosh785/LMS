import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, apiError, apiFieldErrors } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn, ErrorNote, Loading, TextField } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import RazorpayButton from './RazorpayButton.jsx'
import CoverArt from '../../components/CoverArt.jsx'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

/**
 * Checkout, with two payment routes converging on one outcome.
 *
 * **Razorpay** when it is configured: instant, and access is granted by the
 * verified webhook. **Manual UPI** otherwise, or for a buyer whose card fails —
 * it is the only mechanism that worked at launch and it stays as a fallback, so
 * a gateway outage is a slower sale rather than no sale.
 *
 * Works logged out on purpose: an account wall in front of the money loses
 * sales, and the approval flow creates the account.
 */
export default function Checkout() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const planName = params.get('plan') || ''
  const { user } = useAuth()
  const [done, setDone] = useState(null)
  const [fields, setFields] = useState({})
  const [copied, setCopied] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  // Shared by both routes, so switching between them does not lose what the
  // buyer already typed.
  const [buyer, setBuyer] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const setField = (key) => (e) => setBuyer((b) => ({ ...b, [key]: e.target.value }))

  const { data, isPending, error } = useQuery({
    queryKey: ['checkout', slug, planName],
    queryFn: async () =>
      (await api.get(`/checkout/${slug}`, { params: planName ? { plan: planName } : {} })).data,
    retry: false,
  })

  useDocumentTitle(
    data ? `Checkout — ${data.course.title} | Growth Scholar` : 'Checkout | Growth Scholar',
  )

  const submitUpi = useMutation({
    mutationFn: async (payload) => (await api.post('/checkout/upi', payload)).data,
    onSuccess: (res) => setDone({ ...res, route: 'upi' }),
    onError: (err) => setFields(apiFieldErrors(err)),
  })

  const onSubmitUpi = (e) => {
    e.preventDefault()
    setFields({})
    const utr = new FormData(e.currentTarget).get('utr')
    submitUpi.mutate({ ...buyer, utr, slug, plan: data?.plan?.name || undefined })
  }

  const copyVpa = async () => {
    try {
      await navigator.clipboard.writeText(data.upi.vpa)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is blocked outside a secure context — the VPA is printed
      // right there to be typed, so this is a nicety, not a dependency.
    }
  }

  if (isPending) return <Loading label="Loading checkout…" />

  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Checkout unavailable</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{apiError(error)}</p>
        <Button to={`/courses/${slug}`} variant="outline" className="mt-5">
          Back to the course
        </Button>
      </div>
    )
  }

  const { course, plan, upi, gateway, verificationWindow } = data

  /* --------------------------- submitted state --------------------------- */
  if (done) {
    // The gateway settles in seconds; a manual UPI claim waits for a person.
    // Saying so precisely is what prevents a support email an hour later.
    const settled = done.settled
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <div className="rounded-xl2 border border-line bg-white p-8 shadow-soft mx-560:p-6">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-2xl">
            ✓
          </span>
          <h1 className="mt-4 text-[1.5rem]">
            {settled ? "You're in" : 'Payment details received'}
          </h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
            {settled ? (
              <>
                Payment confirmed and <strong className="text-brand-deep">{course.title}</strong> is
                open on your account. Check your email for your sign-in link.
              </>
            ) : (
              <>
                We are checking your payment against our bank statement. Access to{' '}
                <strong className="text-brand-deep">{course.title}</strong> opens{' '}
                {verificationWindow}, and we will email you the moment it does.
              </>
            )}
          </p>

          {done.transactionId && (
            <dl className="mt-6 grid gap-2 rounded-lg2 border border-line bg-surface px-4 py-3 text-left text-[0.85rem]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Reference ID</dt>
                <dd className="break-all font-semibold text-brand-deep">{done.transactionId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Status</dt>
                <dd className={cn('font-semibold', settled ? 'text-ok' : 'text-warn')}>
                  {settled ? 'Paid' : 'Awaiting verification'}
                </dd>
              </div>
            </dl>
          )}

          {settled ? (
            <Button to="/login" block className="mt-6">
              Sign in and start
            </Button>
          ) : (
            <>
              <p className="mt-4 text-[0.8rem] text-muted">
                Keep this reference. If you do not hear from us in that window, reply to the email
                we just sent.
              </p>
              <Button to="/courses" variant="outline" block className="mt-6">
                Browse more courses
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ----------------------------- checkout form --------------------------- */
  const contactFields = (
    <>
      <TextField
        name="name"
        label="Full name"
        autoComplete="name"
        value={buyer.name}
        onChange={setField('name')}
        required
        error={fields.name}
      />
      <TextField
        name="email"
        type="email"
        label="Email"
        hint="Your course access is sent here"
        autoComplete="email"
        inputMode="email"
        value={buyer.email}
        onChange={setField('email')}
        required
        error={fields.email}
      />
      <TextField
        name="phone"
        type="tel"
        label="Phone"
        autoComplete="tel"
        inputMode="tel"
        value={buyer.phone}
        onChange={setField('phone')}
        required
        error={fields.phone}
      />
    </>
  )

  const summary = (
    <section className="rounded-xl2 border border-line bg-white p-6 shadow-soft mx-560:p-5">
      <CoverArt
        image={course.image}
        imageAlt={course.imageAlt}
        gradientClass={course.thumbClass}
        label={course.mediaLabel || course.title}
        labelClass="text-[1rem] px-3"
        className="mb-4 h-24 rounded-lg2"
        sizes="360px"
      />
      <h2 className="text-[1.05rem]">{course.title}</h2>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="text-[1.6rem] font-black text-brand-deep">{inr(plan.amount)}</span>
        <span className="text-[0.8rem] text-muted">
          {plan.name ? `${plan.name} · ` : ''}
          {plan.access === 'Lifetime' ? 'Lifetime access' : `${plan.access} access`}
        </span>
      </div>
      <ul className="mt-4 grid gap-2 text-[0.85rem] text-muted">
        {[
          `${course.moduleCount} modules`,
          `${course.hours} hours of recorded content`,
          'Certificate on completion',
        ].map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-accent-mid">✓</span>
            {b}
          </li>
        ))}
      </ul>
    </section>
  )

  const upiPanel = upi && (
    <>
      <h3 className="text-[0.95rem]">Pay by UPI</h3>
      <p className="mt-1 text-[0.85rem] text-muted">
        Scan this with any UPI app, or pay the ID below. The amount is filled in for you.
      </p>

      {/*
        The QR grows on a phone rather than shrinking. It is most often
        photographed by a *second* device, and a 220px code scanned across a
        table is where scanning starts failing. SVG, so enlarging costs no
        sharpness; the white padding is the quiet zone scanners need.
      */}
      <div className="mt-4 grid place-items-center rounded-lg2 border border-line bg-white p-4">
        <img
          src={upi.qrDataUri}
          alt={`UPI QR code to pay ${inr(plan.amount)} to ${upi.payeeName}`}
          width={220}
          height={220}
          className="h-auto w-full max-w-[220px] mx-860:max-w-[320px] mx-360:max-w-[260px]"
        />
      </div>

      <div className="mt-4 grid gap-2 rounded-lg2 border border-line bg-surface px-4 py-3 text-[0.85rem]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">UPI ID</span>
          <span className="flex items-center gap-2">
            <span className="break-all font-semibold text-brand-deep">{upi.vpa}</span>
            <button
              type="button"
              onClick={copyVpa}
              className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.72rem] font-semibold text-brand hover:bg-accent-soft"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Payee</span>
          <span className="text-right font-semibold text-brand-deep">{upi.payeeName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Amount</span>
          <span className="font-semibold text-brand-deep">{inr(plan.amount)}</span>
        </div>
      </div>

      {/* An intent link only works on the device running a UPI app, so it is
          offered alongside the QR rather than instead of it. */}
      <a
        href={upi.intentUri}
        className="mt-3 block text-center text-[0.85rem] font-semibold text-brand hover:underline"
      >
        Open a UPI app on this phone →
      </a>

      <form onSubmit={onSubmitUpi} className="mt-6 grid gap-4">
        {!gateway && contactFields}
        <TextField
          name="utr"
          label="UPI reference / UTR"
          hint="The 12-digit number in your payment app's receipt"
          inputMode="numeric"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          required
          error={fields.utr}
        />
        {!fields.utr && !fields.email && (
          <ErrorNote error={submitUpi.error && apiError(submitUpi.error)} />
        )}
        <Button
          type="submit"
          block
          variant={gateway ? 'outline' : 'primary'}
          disabled={submitUpi.isPending}
        >
          {submitUpi.isPending ? 'Submitting…' : "I've paid — submit for verification"}
        </Button>
      </form>

      <div className="mt-5 rounded-lg2 border border-warn/30 bg-warn/5 px-4 py-3 text-[0.82rem] leading-relaxed text-muted">
        <strong className="text-brand-deep">This route is not instant.</strong> A person checks each
        UPI payment against our bank statement. Your course opens{' '}
        <strong className="text-brand-deep">{verificationWindow}</strong> and you will get an email
        as soon as it does.
      </div>
    </>
  )

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <nav className="mb-4 text-[0.8rem] text-muted">
        <Link to="/courses" className="hover:text-brand">
          Courses
        </Link>
        <span className="px-1.5">/</span>
        <Link to={`/courses/${slug}`} className="hover:text-brand">
          {course.title}
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-brand-deep">Checkout</span>
      </nav>

      <h1 className="text-[clamp(1.5rem,3vw,2rem)]">Complete your payment</h1>

      <div className="mt-6 grid grid-cols-[1fr_1fr] items-start gap-8 mx-860:grid-cols-1 mx-860:gap-6">
        {summary}

        <section className="rounded-xl2 border border-line bg-white p-6 shadow-soft mx-560:p-5">
          {gateway ? (
            <>
              <h3 className="text-[0.95rem]">Pay now</h3>
              <p className="mt-1 text-[0.85rem] text-muted">
                Card, netbanking, wallet or UPI. Access opens as soon as the payment clears.
              </p>

              <div className="mt-5 grid gap-4">
                {contactFields}
                <RazorpayButton
                  slug={slug}
                  plan={plan}
                  gateway={gateway}
                  buyer={buyer}
                  onFieldErrors={setFields}
                  onSettled={(res) => setDone({ ...res, route: 'gateway' })}
                />
              </div>

              {upi && (
                <div className="mt-6 border-t border-line pt-5">
                  {manualOpen ? (
                    upiPanel
                  ) : (
                    /* The manual route stays available: it is the fallback when
                       a card fails, and the only thing that worked at launch. */
                    <button
                      type="button"
                      onClick={() => setManualOpen(true)}
                      className="w-full text-center text-[0.85rem] font-semibold text-brand hover:underline"
                    >
                      Card not working? Pay by UPI transfer instead →
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            upiPanel
          )}

          <p className="mt-5 text-center text-[0.78rem] text-muted">
            By paying you agree to our{' '}
            <Link to="/terms" className="text-brand hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/refund" className="text-brand hover:underline">
              Refund Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
