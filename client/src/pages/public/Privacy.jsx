import { Link } from 'react-router-dom'
import LegalPage, { Bullets, Field, Mail, Section } from '../../components/public/LegalPage.jsx'
import useBusiness from '../../hooks/useBusiness.js'

export default function Privacy() {
  const business = useBusiness()
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal information Growth Scholar collects when you browse the site, book a mentor call or buy a course, how we use it, who we share it with, and the choices you have."
    >
      <Section id="who-we-are" title="1. Who we are">
        <p>
          Growth Scholar is an online marketing education platform operated by{' '}
          <Field value={business.legalName} label="registered legal entity name" />, with its
          registered office at{' '}
          <Field value={business.address} label="full registered office address with PIN code" />.
          In this policy “we”, “us” and “Growth Scholar” refer to that entity, and “you” refers to
          anyone who visits the site or holds an account.
        </p>
        <p>
          For anything in this policy, write to <Mail address={business.supportEmail} />.
        </p>
      </Section>

      <Section id="what-we-collect" title="2. Information we collect">
        <Bullets>
          <li>
            <strong className="text-brand-deep">Account details</strong> — your name, email address,
            password (stored only as a one-way hash, never in readable form) and, where you provide
            it, your phone number.
          </li>
          <li>
            <strong className="text-brand-deep">Enquiry and lead details</strong> — everything you
            type into a form on the site, including the “Talk to a Growth Mentor” popup: name,
            email, phone number, educational qualification, current profile, year of passing and
            preferred language.
          </li>
          <li>
            <strong className="text-brand-deep">Purchase details</strong> — the course you bought,
            the amount, and the UPI transaction reference (UTR) or payment reference you submit at
            checkout so we can match your payment against our bank statement. We never ask for, see
            or store your card number, CVV, UPI PIN, netbanking password or any other banking
            credential.
          </li>
          <li>
            <strong className="text-brand-deep">Learning activity</strong> — courses you are
            enrolled in, lessons completed, practice and challenge submissions, quiz results,
            certificates earned and points or badges awarded.
          </li>
          <li>
            <strong className="text-brand-deep">Community content</strong> — posts, comments and
            replies you publish in the community area, which are visible to other members of that
            community.
          </li>
          <li>
            <strong className="text-brand-deep">Technical data</strong> — IP address, browser and
            device type, pages visited and timestamps, collected in ordinary server logs to keep the
            service running and secure.
          </li>
        </Bullets>
      </Section>

      <Section id="how-we-use" title="3. How we use your information">
        <Bullets>
          <li>To create and run your account and grant access to the courses you have paid for.</li>
          <li>To verify a UPI payment against our bank records before releasing course access.</li>
          <li>
            To send transactional messages you cannot opt out of while you hold an account — payment
            confirmation, access granted, password reset, class reminders and important service
            notices.
          </li>
          <li>
            To respond to enquiries, arrange mentor calls and provide support, including on the
            phone number you supply.
          </li>
          <li>
            To send marketing about courses, workshops and offers where you have consented. Every
            marketing email carries an unsubscribe link, and unsubscribing does not affect your
            course access.
          </li>
          <li>
            To measure which courses and pages are useful so we can improve the curriculum and the
            site.
          </li>
          <li>To detect and prevent fraud, credential sharing, content piracy and abuse.</li>
          <li>To meet legal, accounting and tax obligations.</li>
        </Bullets>
      </Section>

      <Section id="basis" title="4. Consent and lawful basis">
        <p>
          We process your information on the basis of the consent you give when you submit a form or
          create an account, to perform the contract between us when you buy a course, and where
          processing is necessary to comply with law. You can withdraw consent for marketing at any
          time, as described in section 8.
        </p>
      </Section>

      <Section id="sharing" title="5. Who we share it with">
        <p>
          We do not sell your personal information, and we do not rent or trade contact lists. We
          share the minimum necessary with service providers who help us run the platform, and each
          of them is permitted to use it only for that purpose:
        </p>
        <Bullets>
          <li>Hosting and database providers who store the application and its data.</li>
          <li>Video hosting and streaming providers who deliver course lessons to your browser.</li>
          <li>
            Email delivery providers who send transactional and marketing messages on our behalf.
          </li>
          <li>
            Payment providers and our bank, to accept payment and to verify or refund a transaction.
            Payment instruments are handled by them, not by us.
          </li>
          <li>
            Professional advisers, and law enforcement or courts where we are legally required to
            disclose information.
          </li>
        </Bullets>
      </Section>

      <Section id="cookies" title="6. Cookies and browser storage">
        <p>
          When you log in we set a secure, HTTP-only session cookie so the site can recognise you on
          your next request. It is essential — without it you cannot stay logged in. We also use
          your browser’s session storage to remember that you have already seen or dismissed the
          mentor-call popup, so it does not reappear on every page.
        </p>
        <p>
          We do not currently run third-party advertising or cross-site tracking cookies on this
          site. If that changes, this policy will be updated before those cookies are set.
        </p>
      </Section>

      <Section id="retention" title="7. How long we keep it">
        <p>
          Account, enrolment and payment records are kept for as long as you hold an account and
          afterwards for as long as required for accounting, tax and legal purposes. Enquiry and
          lead records are kept for as long as they are useful for follow-up and then deleted or
          anonymised. You can ask us to delete your data sooner, as described below.
        </p>
      </Section>

      <Section id="rights" title="8. Your choices and rights">
        <Bullets>
          <li>Ask for a copy of the personal information we hold about you.</li>
          <li>
            Ask us to correct anything inaccurate — most of it you can edit yourself in your
            profile.
          </li>
          <li>
            Ask us to delete your account and personal information, subject to records we must
            retain by law. Deleting your account ends access to any course you are enrolled in and
            does not by itself entitle you to a refund.
          </li>
          <li>Withdraw consent to marketing by using the unsubscribe link or emailing us.</li>
        </Bullets>
        <p>
          Send any of these requests to <Mail address={business.supportEmail} /> from the email
          address on your account. We may ask you to verify your identity before acting.
        </p>
      </Section>

      <Section id="security" title="9. Security">
        <p>
          We protect your information with reasonable technical and organisational measures,
          including encrypted connections (HTTPS), hashed passwords, HTTP-only session cookies and
          access controls that limit staff access to what their role needs. No system is perfectly
          secure, so please use a strong, unique password and do not share your login. If you
          believe your account has been compromised, tell us immediately at{' '}
          <Mail address={business.supportEmail} />.
        </p>
      </Section>

      <Section id="children" title="10. Children">
        <p>
          The platform is intended for users aged 18 and over. A minor may use it only with the
          involvement and consent of a parent or guardian, who is responsible for the account. If we
          learn that we hold information about a child collected without such consent, we will
          delete it.
        </p>
      </Section>

      <Section id="changes" title="11. Changes to this policy">
        <p>
          We may update this policy as the platform changes — for example when we switch from manual
          UPI verification to an automated payment gateway. The “last updated” date at the top
          always reflects the current version, and material changes will be notified by email or an
          on-site notice.
        </p>
      </Section>

      <Section id="grievance" title="12. Grievance officer">
        <p>
          In line with the Information Technology Act, 2000 and the rules made under it, and the
          Digital Personal Data Protection Act, 2023, complaints about the handling of your personal
          information can be addressed to our grievance officer:
        </p>
        <Bullets>
          <li>
            Name: <Field value={business.grievanceOfficer} label="grievance officer name" />
          </li>
          <li>
            Email: <Mail address={business.supportEmail} />
          </li>
          <li>
            Phone: <Field value={business.phone} label="support phone number" />
          </li>
          <li>
            Address:{' '}
            <Field value={business.address} label="full registered office address with PIN code" />
          </li>
        </Bullets>
        <p>
          We acknowledge complaints and work to resolve them within the timelines required by law.
          Our full contact details are on the{' '}
          <Link to="/contact" className="font-semibold text-brand underline">
            contact page
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
