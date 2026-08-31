import { Link } from 'react-router-dom'
import LegalPage, { Bullets, Field, Mail, Section } from '../../components/public/LegalPage.jsx'
import useBusiness from '../../hooks/useBusiness.js'

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-line py-3 last:border-b-0 mx-640:grid-cols-1 mx-640:gap-1">
      <dt className="text-[0.8rem] font-bold uppercase tracking-tighter2 text-brand-deep">
        {label}
      </dt>
      <dd className="text-[0.92rem] leading-relaxed text-muted">{children}</dd>
    </div>
  )
}

export default function Contact() {
  const business = useBusiness()
  return (
    <LegalPage
      title="Contact Us"
      intro="Questions before you buy, trouble with a payment, or anything about your course access — here is how to reach a human at Growth Scholar."
    >
      <Section id="business" title="Business details">
        <dl className="rounded-lg2 border border-line px-4 py-1">
          <DetailRow label="Business name">
            {business.brandName} — operated by{' '}
            <Field value={business.legalName} label="registered legal entity name" />
          </DetailRow>
          <DetailRow label="Registered address">
            <Field value={business.address} label="full registered office address with PIN code" />
          </DetailRow>
          <DetailRow label="Support email">
            <Mail address={business.supportEmail} />
          </DetailRow>
          <DetailRow label="Sales email">
            <Mail address={business.salesEmail} />
          </DetailRow>
          <DetailRow label="Phone">
            <Field value={business.phone} label="support phone number" />
          </DetailRow>
          <DetailRow label="Support hours">
            <Field
              value={business.supportHours}
              label="support days and hours, e.g. Mon–Sat 10:00–19:00 IST"
            />
          </DetailRow>
          <DetailRow label="Country">India</DetailRow>
          <DetailRow label="GST">
            Prices are inclusive. GST not applicable — we are not registered under GST, so invoices
            carry no tax component.
          </DetailRow>
        </dl>
      </Section>

      <Section id="which-inbox" title="Which address to write to">
        <Bullets>
          <li>
            <strong className="text-brand-deep">Course access, payments and refunds</strong> —{' '}
            <Mail address={business.supportEmail} />. Include your registered email address, the
            course name and the UPI transaction reference (UTR) so we can find your order on the
            first reply.
          </li>
          <li>
            <strong className="text-brand-deep">
              Which course to pick, group and corporate enquiries
            </strong>{' '}
            — <Mail address={business.salesEmail} />, or book a free mentor call from any page on
            the site.
          </li>
          <li>
            <strong className="text-brand-deep">Privacy requests and complaints</strong> —{' '}
            <Mail address={business.supportEmail} />, addressed to the grievance officer named in
            our{' '}
            <Link to="/privacy" className="font-semibold text-brand underline">
              Privacy Policy
            </Link>
            .
          </li>
        </Bullets>
      </Section>

      <Section id="response" title="Response times">
        <p>
          We answer email during our working hours, shown above. If you have paid and are waiting
          for course access, please read the confirmation window in our{' '}
          <Link to="/delivery" className="font-semibold text-brand underline">
            Delivery Policy
          </Link>{' '}
          first — payments are verified by hand, so access follows the payment by a short interval
          rather than arriving instantly.
        </p>
      </Section>

      <Section id="policies" title="Our policies">
        <p>
          The full terms that apply to a purchase are set out in our{' '}
          <Link to="/terms" className="font-semibold text-brand underline">
            Terms of Use
          </Link>
          ,{' '}
          <Link to="/privacy" className="font-semibold text-brand underline">
            Privacy Policy
          </Link>
          ,{' '}
          <Link to="/refund" className="font-semibold text-brand underline">
            Refund and Cancellation Policy
          </Link>{' '}
          and{' '}
          <Link to="/delivery" className="font-semibold text-brand underline">
            Delivery Policy
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
