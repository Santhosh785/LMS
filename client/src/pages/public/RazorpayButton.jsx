import { useState } from 'react'
import { api, apiError, apiFieldErrors } from '../../api/client.js'
import { Button, ErrorNote } from '../../components/ui/index.jsx'

/**
 * Razorpay's hosted checkout.
 *
 * The script is loaded on demand rather than in index.html — a third-party
 * payment script on every page view is a tracking surface and a render-blocking
 * request for the 99% of visitors who are not buying right now.
 *
 * **Nothing here grants access.** The order is created server-side with the
 * price read from the database, and the enrolment is granted by the verified
 * webhook. This component's callback only decides what the buyer is shown: a
 * buyer whose browser dies on the redirect has still paid, and the webhook
 * delivers their course regardless of anything on this page.
 */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

let scriptPromise = null
function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve(true)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.onload = () => resolve(true)
    el.onerror = () => {
      scriptPromise = null // let a retry try again
      reject(new Error('Could not reach the payment gateway'))
    }
    document.body.appendChild(el)
  })
  return scriptPromise
}

export default function RazorpayButton({ slug, plan, gateway, buyer, onSettled, onFieldErrors }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const pay = async () => {
    setError(null)
    setBusy(true)
    try {
      await loadCheckoutScript()

      // The server reads the amount from the database; the request carries only
      // a slug and a plan name.
      const { data: order } = await api.post('/checkout/razorpay/order', {
        slug,
        plan: plan?.name || undefined,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
      })

      const rzp = new window.Razorpay({
        key: gateway.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Growth Scholar',
        description: order.courseTitle,
        prefill: {
          name: order.buyer.name,
          email: order.buyer.email,
          contact: order.buyer.phone,
        },
        theme: { color: '#135855' },
        handler: async (response) => {
          try {
            const { data } = await api.post('/checkout/razorpay/callback', response)
            onSettled?.(data)
          } catch (err) {
            // The payment went through — Razorpay would not have called this
            // otherwise. Only our confirmation lookup failed, so say something
            // reassuring rather than something alarming.
            setError(
              'Payment received. We are confirming it now — you will get an email as soon as your course opens.',
            )
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      })

      rzp.on('payment.failed', (event) => {
        setError(event?.error?.description || 'That payment did not go through. Please try again.')
        setBusy(false)
      })

      rzp.open()
    } catch (err) {
      const fields = apiFieldErrors(err)
      if (Object.keys(fields).length) onFieldErrors?.(fields)
      setError(apiError(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <Button type="button" block onClick={pay} disabled={busy}>
        {busy ? 'Opening…' : 'Pay by card, netbanking or UPI app'}
      </Button>
      <p className="text-center text-[0.78rem] text-muted">Instant access. Secured by Razorpay.</p>
      <ErrorNote error={error} />
    </div>
  )
}
