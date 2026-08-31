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

export default function Terms() {
  const business = useBusiness()
  return (
    <LegalPage
      title="Terms of Use"
      intro="These terms are the agreement between you and Growth Scholar. They cover your account, what you may do with our course content, how payment works, and the limits of what we promise. By using the site or buying a course you accept them."
    >
      <Section id="acceptance" title="1. Acceptance of these terms">
        <p>
          The Growth Scholar platform is operated by{' '}
          <Field value={business.legalName} label="registered legal entity name" />, registered at{' '}
          <Field value={business.address} label="full registered office address with PIN code" />.
          By creating an account, buying a course, or otherwise using the site, you confirm that you
          have read and agree to these terms and to our{' '}
          <Link to="/privacy" className="font-semibold text-brand underline">
            Privacy Policy
          </Link>
          ,{' '}
          <Link to="/refund" className="font-semibold text-brand underline">
            Refund Policy
          </Link>{' '}
          and{' '}
          <Link to="/delivery" className="font-semibold text-brand underline">
            Delivery Policy
          </Link>
          . If you do not agree, please do not use the platform.
        </p>
      </Section>

      <Section id="eligibility" title="2. Eligibility and your account">
        <Bullets>
          <li>
            You must be 18 or older, or use the platform with the consent and supervision of a
            parent or guardian.
          </li>
          <li>
            The details you give us — name, email, phone — must be accurate and kept up to date.
          </li>
          <li>
            Your account is personal to you. You are responsible for keeping your password
            confidential and for everything done through your account.
          </li>
          <li>
            Sharing your login, or letting anyone else view paid content through your account, is a
            breach of these terms.
          </li>
          <li>
            Tell us at once at <Mail address={business.supportEmail} /> if you suspect unauthorised
            use.
          </li>
        </Bullets>
      </Section>

      <Section id="access" title="3. Course enrolment and access">
        <p>
          When your payment is confirmed we grant you a personal, non-exclusive, non-transferable,
          revocable licence to view the course content for the access period of the plan you bought.
          Plans are sold as lifetime, 12-month or 6-month access, and the period that applies to
          your purchase is the one shown on the course page at the time of purchase. “Lifetime”
          means for as long as we continue to operate the course on the platform.
        </p>
        <p>
          We may update, re-record, reorganise or retire course content to keep it current. Where a
          course is retired entirely we will give reasonable notice to learners who still hold
          active access.
        </p>
      </Section>

      <Section id="pricing" title="4. Pricing, taxes and payment">
        <Callout title="Prices are inclusive. GST not applicable.">
          All prices are shown in Indian Rupees (INR) and are the total amount payable. We are not
          registered under GST, so no tax is added at checkout, no tax breakdown is shown, and
          invoices carry no tax component.
        </Callout>
        <Bullets>
          <li>
            The price payable is the one displayed on the course page at the time you place the
            order. We may change prices or run offers at any time; changes do not apply to a
            purchase already completed.
          </li>
          <li>
            Payment is currently collected by UPI transfer. After you pay, you submit the UPI
            transaction reference (UTR) and our team verifies it against our bank records before
            opening access — this is a manual step and access is not instant. The window is set out
            in the{' '}
            <Link to="/delivery" className="font-semibold text-brand underline">
              Delivery Policy
            </Link>
            .
          </li>
          <li>
            You are responsible for any charge your own bank or payment app levies on the transfer.
          </li>
          <li>
            Paying for a course does not create any obligation on us until we have verified the
            payment. If a payment cannot be verified, we will return the amount actually received to
            the account it came from.
          </li>
        </Bullets>
      </Section>

      <Section id="refunds" title="5. Cancellation and refunds">
        <p>
          Cancellations and refunds are governed by our{' '}
          <Link to="/refund" className="font-semibold text-brand underline">
            Refund Policy
          </Link>
          , which forms part of these terms. In short: a purchase that has not yet been verified can
          be cancelled for a full refund, and after access is granted a refund may be requested
          within{' '}
          <Field
            value={policyTerms.refundWindowDays}
            label="refund window in days after access is granted"
          />{' '}
          subject to the conditions set out there.
        </p>
      </Section>

      <Section id="ip" title="6. Our content and what you may do with it">
        <p>
          All course videos, worksheets, templates, slides, text, graphics, the Growth Scholar name
          and logo, and the platform itself, are owned by us or licensed to us and are protected by
          copyright and trade mark law. You may use them only for your own learning.
        </p>
        <p>You must not:</p>
        <Bullets>
          <li>
            Download, record, screen-capture, copy or mirror course videos or materials, except
            where a download is explicitly offered.
          </li>
          <li>
            Share, resell, sublicense, publish or upload our content anywhere, including on
            messaging groups, drives or other course platforms.
          </li>
          <li>Share your login, or use another person’s login, to access paid content.</li>
          <li>Use our content to build or teach a competing course or product.</li>
          <li>
            Attempt to bypass paywalls, DRM, rate limits or access controls, or scrape the site by
            automated means.
          </li>
        </Bullets>
        <p>
          Piracy and credential sharing directly damage a small education business. If you breach
          this section we may suspend or terminate your access immediately and without refund, and
          pursue any other remedy available to us.
        </p>
      </Section>

      <Section id="community" title="7. Community conduct">
        <p>
          The community area, live classes and comment threads are shared spaces. You are
          responsible for what you post there, you must not post anything unlawful, abusive,
          hateful, sexually explicit, defamatory, misleading, spam, or anyone else’s copyrighted
          material, and you must not solicit other learners for your own products or services
          without our permission. We may remove content and suspend accounts that break these rules.
        </p>
      </Section>

      <Section id="live" title="8. LIVE classes, workshops and mentor calls">
        <p>
          Timings for live sessions are announced in advance. We may reschedule a session where a
          trainer is unavailable or for technical or other operational reasons, and we will notify
          enrolled learners by email or on the dashboard. Where a session is recorded, the recording
          may be made available to enrolled learners for the access period of their plan; a
          recording is not guaranteed unless the course page says so. Attending a live session needs
          a stable internet connection at your end, which is your responsibility.
        </p>
      </Section>

      <Section id="certificates" title="9. Certificates and outcomes">
        <p>
          Certificates issued on completion are issued by Growth Scholar as evidence of completing
          our course. They are not a degree, diploma or any qualification accredited by a
          university, government body or regulator.
        </p>
        <p>
          Our courses teach skills — they are not an offer of employment and we do not promise a
          job, an internship, a salary, a placement, or any specific business or marketing result.
          Outcomes depend on your effort, experience and market conditions.
        </p>
      </Section>

      <Section id="third-party" title="10. Third-party services and links">
        <p>
          The platform links to and depends on third-party services (payment providers, video
          hosting, email delivery, advertising platforms used in exercises). We are not responsible
          for the content, availability or policies of any third-party site or service, and your use
          of them is governed by their own terms.
        </p>
      </Section>

      <Section id="suspension" title="11. Suspension and termination">
        <p>
          We may suspend or terminate your account if you breach these terms, if we detect fraud,
          piracy or credential sharing, or where required by law. You may close your account at any
          time by writing to <Mail address={business.supportEmail} />. Termination does not create a
          right to a refund except as set out in the Refund Policy.
        </p>
      </Section>

      <Section id="warranty" title="12. Disclaimer">
        <p>
          The platform and its content are provided “as is” and “as available”. We work to keep the
          site up and the content accurate, but we do not warrant that it will be uninterrupted,
          error-free, or that the content is suitable for your particular situation. Nothing on the
          platform is legal, financial or professional advice.
        </p>
      </Section>

      <Section id="liability" title="13. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental,
          special or consequential loss, or for loss of profit, revenue, data, business or goodwill,
          arising out of your use of the platform. Our total liability for any claim relating to a
          course is limited to the amount you actually paid us for that course. Nothing here
          excludes liability that cannot be excluded under Indian law.
        </p>
      </Section>

      <Section id="changes" title="14. Changes to these terms">
        <p>
          We may amend these terms as the platform evolves — for example when card and netbanking
          payments go live alongside UPI. The current version is always the one on this page, with
          the “last updated” date at the top. Continuing to use the platform after a change means
          you accept the amended terms.
        </p>
      </Section>

      <Section id="law" title="15. Governing law and jurisdiction">
        <p>
          These terms are governed by the laws of India. The courts at{' '}
          <Field
            value={business.jurisdictionCity}
            label="city whose courts have exclusive jurisdiction"
          />{' '}
          have exclusive jurisdiction over any dispute arising from them. Before starting any
          proceeding, please write to us at <Mail address={business.supportEmail} /> so we can try
          to resolve the matter directly.
        </p>
      </Section>

      <Section id="contact" title="16. How to reach us">
        <p>
          Questions about these terms go to <Mail address={business.supportEmail} />, or use the
          details on our{' '}
          <Link to="/contact" className="font-semibold text-brand underline">
            contact page
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
