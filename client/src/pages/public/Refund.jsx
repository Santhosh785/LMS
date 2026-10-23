import { Link, useLoaderData } from 'react-router'
import LegalPage, {
  Bullets,
  Callout,
  Field,
  Mail,
  Section,
} from '../../components/public/LegalPage.jsx'
import { policyTerms } from '../../data/legal.js'

export default function Refund() {
  const { business } = useLoaderData()
  return (
    <LegalPage
      business={business}
      title="Refund and Cancellation Policy"
      intro="Growth Scholar sells digital course access, not physical products. All sales are final once access is granted. This policy explains the few cases where we do refund, how to ask, and how long it takes to reach you."
    >
      <Section id="summary" title="1. In short">
        <Callout title="All sales are final once your access is opened.">
          We do not offer refunds after a course, workshop or program has been opened on your
          account. Before that, you can cancel a pending order for a full refund. We also refund
          duplicate or excess payments, and any order we cannot deliver.
        </Callout>
        <p>
          Course fees are paid by UPI and confirmed manually by our team against our bank statement,
          so access is not instant. Prices are inclusive. GST not applicable — the amount you paid
          is the amount considered for any refund, with no tax component to deduct or adjust.
        </p>
      </Section>

      <Section id="what-you-buy" title="2. What you are buying">
        <p>
          Every product on this site is a digital service: access to online course content, live
          sessions and community features hosted on the Growth Scholar platform. Nothing is shipped,
          and no physical goods are dispatched or returned. How and when access is delivered is set
          out in our{' '}
          <Link to="/delivery" className="font-semibold text-brand underline">
            Delivery Policy
          </Link>
          .
        </p>
      </Section>

      <Section id="before-access" title="3. Cancelling before access is granted">
        <p>
          After you pay by UPI and submit your transaction reference, your order sits as pending
          until an administrator verifies the payment. During that window:
        </p>
        <Bullets>
          <li>
            You may cancel for any reason by emailing <Mail address={business.supportEmail} /> with
            the transaction reference (UTR) and the email address you used at checkout. We will
            refund the full amount received.
          </li>
          <li>
            If we cannot match your payment to a credit in our bank account, we will contact you on
            the email or phone number you gave. If it turns out that money left your account but
            never reached ours, the transfer has failed at the payment network and your bank or UPI
            app will reverse it — we can only refund money we have actually received.
          </li>
        </Bullets>
      </Section>

      <Section id="after-access" title="4. No refunds after access is granted">
        <p>
          Once we confirm your payment, the course is opened on your account and the content is
          delivered in full and immediately. From that point the fee is non-refundable, including
          where:
        </p>
        <Bullets>
          <li>You have watched little or none of the course.</li>
          <li>
            The reason is a change of mind about the subject, lack of time, or the absence of a
            specific career or business outcome, which we do not promise.
          </li>
          <li>
            The course was received free, as part of a bundle, or through a scholarship or coupon.
          </li>
          <li>
            Access was terminated for breach of our{' '}
            <Link to="/terms" className="font-semibold text-brand underline">
              Terms of Use
            </Link>{' '}
            — for example sharing your login or redistributing course content.
          </li>
        </Bullets>
        <p>
          A confirmed seat in a LIVE program or workshop is also non-refundable. If you cannot
          attend, you may ask us to move you to a later batch; we will try to, subject to
          availability.
        </p>
      </Section>

      <Section id="exceptions" title="5. When we do refund">
        <Bullets>
          <li>
            <strong className="text-brand-deep">Duplicate or excess payment</strong> — if you paid
            twice for the same course, or transferred more than the listed price, we refund the
            extra amount in full. Send both transaction references to{' '}
            <Mail address={business.supportEmail} />.
          </li>
          <li>
            <strong className="text-brand-deep">We cannot deliver</strong> — if we receive your
            money but cannot give you access for any reason at our end, or we cancel a LIVE batch or
            workshop you paid for and you do not want a seat in a later one, we refund the full
            amount without you having to ask.
          </li>
          <li>
            <strong className="text-brand-deep">Cancelled before access</strong> — as set out in
            section 3.
          </li>
        </Bullets>
        <p>
          To claim one of these, email <Mail address={business.supportEmail} /> from the address on
          your account with the subject “Refund request”, your name, the course name, and the UPI
          transaction reference (UTR) and date of payment. We acknowledge every request and tell you
          the outcome.
        </p>
      </Section>

      <Section id="processing" title="6. How a refund is paid">
        <Bullets>
          <li>
            Approved refunds are sent back to the same UPI ID or bank account the payment came from.
            We do not refund to a different account, and we do not refund in cash or as platform
            credit unless you ask for credit and we agree.
          </li>
          <li>
            The refund is normally initiated within{' '}
            <Field
              value={policyTerms.refundProcessingDays}
              label="working days taken to process an approved refund"
            />{' '}
            of approval. Your bank may take a few additional working days to show the credit.
          </li>
          <li>
            We refund the amount we actually received. Any charge levied by your own bank or payment
            app on the original transfer is not refundable by us.
          </li>
        </Bullets>
      </Section>

      <Section id="disputes" title="7. Disputes and chargebacks">
        <p>
          Please raise any billing problem with us first — we can usually resolve it faster than a
          bank dispute. If a chargeback or payment dispute is raised while a refund request is
          already in progress with us, access to the course is suspended until the dispute is
          settled.
        </p>
      </Section>

      <Section id="changes" title="8. Changes to this policy">
        <p>
          We may update this policy, for example when card and netbanking payments replace manual
          UPI verification. The version in force is the one on this page on the date of your
          purchase. Questions go to <Mail address={business.supportEmail} /> or the details on our{' '}
          <Link to="/contact" className="font-semibold text-brand underline">
            contact page
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
