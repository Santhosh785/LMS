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

export default function Refund() {
  const business = useBusiness()
  return (
    <LegalPage
      title="Refund and Cancellation Policy"
      intro="Growth Scholar sells digital course access, not physical products. This policy explains when you can cancel, when a refund is available, how to ask for one, and how long it takes to reach you."
    >
      <Section id="summary" title="1. In short">
        <Callout title="Payments are verified by hand right now.">
          Course fees are paid by UPI and confirmed manually by our team against our bank statement,
          so access is not instant. Until we have verified your payment and opened access, you can
          cancel the order for a full refund of the amount we received. After access is granted, the
          conditions in section 4 apply.
        </Callout>
        <p>
          Prices are inclusive. GST not applicable — the amount you paid is the amount considered
          for any refund, with no tax component to deduct or adjust.
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
          <li>
            If we receive your money but cannot give you access for any reason at our end, we refund
            the full amount without you having to ask.
          </li>
        </Bullets>
      </Section>

      <Section id="after-access" title="4. Refunds after access is granted">
        <p>
          Once we confirm your payment, the course is opened on your account and the content is
          delivered in full and immediately. A refund may still be requested on these terms:
        </p>
        <Bullets>
          <li>
            <strong className="text-brand-deep">Request window</strong> — within{' '}
            <Field
              value={policyTerms.refundWindowDays}
              label="refund window in days after access is granted"
            />{' '}
            of the date access was granted.
          </li>
          <li>
            <strong className="text-brand-deep">Consumption limit</strong> — provided you have
            consumed no more than{' '}
            <Field
              value={policyTerms.refundConsumptionLimit}
              label="maximum course consumption still eligible for a refund"
            />{' '}
            of the course. We check lesson completion and viewing records on your account.
          </li>
          <li>
            <strong className="text-brand-deep">Live batches and workshops</strong> — a seat in a
            LIVE program or workshop can be cancelled up to{' '}
            <Field
              value={policyTerms.liveCancellationCutoff}
              label="notice required to cancel a LIVE batch or workshop seat"
            />{' '}
            before the batch or session starts. After that the seat is committed and the fee is not
            refundable, though you may ask us to move you to a later batch subject to availability.
          </li>
        </Bullets>
        <p>Refunds are not available where:</p>
        <Bullets>
          <li>The request is made after the window above has closed.</li>
          <li>
            You have consumed more of the course than the limit above allows, or have downloaded the
            downloadable materials that come with it.
          </li>
          <li>A certificate has already been issued to you for the course.</li>
          <li>
            The course was received free, as part of a bundle offer with no separate price, or
            through a scholarship or coupon that reduced the price to zero.
          </li>
          <li>
            Access was terminated for breach of our{' '}
            <Link to="/terms" className="font-semibold text-brand underline">
              Terms of Use
            </Link>{' '}
            — for example sharing your login or redistributing course content.
          </li>
          <li>
            The reason given is a change of mind about the subject, lack of time, or the absence of
            a specific career or business outcome, which we do not promise.
          </li>
        </Bullets>
      </Section>

      <Section id="how-to-request" title="5. How to request a refund">
        <p>
          Email <Mail address={business.supportEmail} /> from the address on your account with the
          subject “Refund request”, and include:
        </p>
        <Bullets>
          <li>Your full name and registered email address.</li>
          <li>The course name.</li>
          <li>The UPI transaction reference (UTR) or order reference, and the date of payment.</li>
          <li>The reason for the request.</li>
        </Bullets>
        <p>
          We acknowledge every request and tell you whether it is approved, together with the reason
          if it is not.
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
          <li>
            Access to the course ends when the refund is approved, along with any certificate,
            points or badges earned in it.
          </li>
        </Bullets>
      </Section>

      <Section id="duplicate" title="7. Duplicate and mistaken payments">
        <p>
          If you paid twice for the same course, or transferred more than the listed price, tell us
          at <Mail address={business.supportEmail} /> with both transaction references. We refund
          the extra amount in full, and the conditions in section 4 do not apply to it.
        </p>
      </Section>

      <Section id="disputes" title="8. Disputes and chargebacks">
        <p>
          Please raise any billing problem with us first — we can usually resolve it faster than a
          bank dispute. If a chargeback or payment dispute is raised while a refund request is
          already in progress with us, access to the course is suspended until the dispute is
          settled.
        </p>
      </Section>

      <Section id="changes" title="9. Changes to this policy">
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
