import { useMemo } from 'react'
import { business } from '../data/legal.js'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'

/**
 * Business identity for the policy and contact pages, with admin settings
 * layered over the static defaults.
 *
 * These fields lived in three places that disagreed: `data/legal.js`, the
 * Setting singleton and the server environment. The visible symptom was the
 * Contact and Delivery pages printing "[[ TO BE CONFIRMED: support days and
 * hours ]]" while the settings document held "Mon–Sat, 10am–7pm IST" — nothing
 * read it. Admin wins here; the static file supplies only what admin has no
 * field for yet.
 *
 * The remaining nulls (legal entity, address, phone, jurisdiction, grievance
 * officer) still render as placeholders, and still block Razorpay KYC. Giving
 * them an admin screen is CFG-3.
 */
export default function useBusiness() {
  const { branding, help } = useSiteConfig()

  return useMemo(
    () => ({
      ...business,
      brandName: branding.brandName || business.brandName,
      supportEmail: help.supportEmail || business.supportEmail,
      salesEmail: help.salesEmail || business.salesEmail,
      supportHours: help.hours || business.supportHours,
      helpCenterUrl: help.helpCenterUrl || '',
    }),
    [branding, help],
  )
}
