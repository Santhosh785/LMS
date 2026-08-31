import { Link } from 'react-router-dom'
import LegalPage, {
  Bullets,
  Callout,
  Field,
  Mail,
  Section,
} from '../../components/public/LegalPage.jsx'
import { policyTerms } from '../../data/legal.js'
import useBusiness from '../../hooks/useBusiness.js'

export default function Delivery() {
  const business = useBusiness()
  return (
    <LegalPage
      title="Delivery Policy"
      intro="Growth Scholar sells online courses. There is nothing to ship — “delivery” means unlocking the course on your account. This page explains exactly what you receive, when, and what to do if it does not arrive."
    >
      <Section id="no-shipping" title="1. Digital delivery only — nothing is shipped">
        <p>
          Every product sold on this site is a digital service delivered over the internet: video
          lessons, worksheets, live sessions and community access hosted on the Growth Scholar
          platform. No physical goods are dispatched, no courier is used, and no shipping, handling
          or delivery charge is ever added to your order. Prices are inclusive. GST not applicable.
        </p>
      </Section>

      <Section id="what-you-get" title="2. What delivery means">
        <p>Once your payment is confirmed, we:</p>
        <Bullets>
          <li>
            Enable the course on your Growth Scholar account, with the access period of the plan you
            bought.
          </li>
          <li>
            Create an account for you if you paid without registering, using the email address you
            gave at checkout, and email you a link to set your own password.
          </li>
          <li>
            Send a confirmation email to that address telling you the course is open and how to sign
            in.
          </li>
          <li>
            Send the joining link, or show it on your dashboard, ahead of any live class or workshop
            included in your purchase.
          </li>
        </Bullets>
        <p>
          You then access the content by signing in at any time from your{' '}
          <Link to="/student" className="font-semibold text-brand underline">
            learning dashboard
          </Link>
          , on a phone, tablet or computer.
        </p>
      </Section>

      <Section id="timing" title="3. When access is granted">
        <Callout title="Access is not instant — payments are confirmed by a person.">
          We currently accept payment by UPI transfer. After you pay and submit your UPI transaction
          reference (UTR), a member of our team checks it against our bank statement and then opens
          the course. Verification is normally completed within{' '}
          <Field
            value={policyTerms.paymentConfirmationSla}
            label="admin payment confirmation window, e.g. hours or working days"
          />
          , during our working hours (
          <Field
            value={business.supportHours}
            label="support days and hours, e.g. Mon–Sat 10:00–19:00 IST"
          />
          ). Payments made at night, on a weekend or on a public holiday are verified on the next
          working day.
        </Callout>
        <p>
          Your order stays visible as pending until then. We are working towards an automated
          payment gateway, and when that goes live access will be granted immediately on successful
          payment — this page will be updated at that point.
        </p>
      </Section>

      <Section id="access-period" title="4. How long access lasts">
        <p>
          Course access runs for the period attached to the plan you bought — lifetime, 12 months or
          6 months, as stated on the course page when you purchased. Lifetime means for as long as
          we continue to operate that course on the platform. Time-limited access starts on the day
          access is granted, not on the day you pay.
        </p>
      </Section>

      <Section id="requirements" title="5. What you need at your end">
        <p>
          A device with an up-to-date browser and a stable internet connection. Lessons are
          streamed, not downloaded, so they need to be watched online; downloadable resources are
          marked as such inside the course. We are not able to deliver content offline, on a USB
          drive or on any physical medium.
        </p>
      </Section>

      <Section id="not-received" title="6. If your access has not arrived">
        <p>
          If the confirmation window above has passed and you still cannot see the course, please
          check the spam folder of the email address you used, then write to{' '}
          <Mail address={business.supportEmail} /> with:
        </p>
        <Bullets>
          <li>The email address and phone number used at checkout.</li>
          <li>The course name.</li>
          <li>
            The UPI transaction reference (UTR), the amount and the date and time of the transfer.
          </li>
        </Bullets>
        <p>
          We will trace the payment and either open your access or, where the payment cannot be
          verified, refund the amount received under our{' '}
          <Link to="/refund" className="font-semibold text-brand underline">
            Refund Policy
          </Link>
          .
        </p>
      </Section>

      <Section id="wrong-details" title="7. Wrong details at checkout">
        <p>
          Access is delivered to the email address you enter at checkout, so please make sure it is
          correct and one you can open. If you gave the wrong address, email us from the correct one
          at <Mail address={business.supportEmail} /> with your transaction reference and we will
          move the enrolment across.
        </p>
      </Section>

      <Section id="contact" title="8. Delivery queries">
        <p>
          Anything about delivery — timing, access, joining links — goes to{' '}
          <Mail address={business.supportEmail} />. Full contact details, including our registered
          address, are on the{' '}
          <Link to="/contact" className="font-semibold text-brand underline">
            contact page
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
