import mongoose from 'mongoose'

/** Singleton document backing the four tabs of admin/settings. */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'site', unique: true },
    branding: {
      brandName: { type: String, default: 'Growth Scholar' },
      productName: { type: String, default: 'Growth Scholar Learn' },
      logoUrl: String,
      faviconUrl: String,
      accentColor: { type: String, default: '#3ecf8e' },
    },
    menu: {
      showWorkshops: { type: Boolean, default: true },
      showCourses: { type: Boolean, default: true },
      showCommunity: { type: Boolean, default: true },
      showBlog: { type: Boolean, default: true },
      showPractice: { type: Boolean, default: true },
    },
    help: {
      supportEmail: { type: String, default: 'support@growthscholar.in' },
      salesEmail: { type: String, default: 'hello@growthscholar.in' },
      helpCenterUrl: String,
      hours: { type: String, default: 'Mon–Sat, 10am–7pm IST' },
    },
    domain: {
      host: { type: String, default: 'growthscholar.in' },
      verified: { type: Boolean, default: true },
    },
    gamification: {
      pointsName: { type: String, default: 'Seeds' },
      pointsIcon: { type: String, default: '🌱' },
      leaderboardEnabled: { type: Boolean, default: true },
      showOnProfile: { type: Boolean, default: true },
    },

    /*
     * Everything below used to live only in server/.env, so changing a payment
     * key or turning a module on meant editing a file on the box and
     * restarting. It is admin-editable now, with the environment kept as the
     * fallback — see services/runtimeConfig.js for the precedence rule.
     *
     * Fields named `*Enc` hold AES-256-GCM ciphertext (utils/secretBox.js) and
     * carry `select: false`, so an ordinary query cannot return a live API key
     * even by accident.
     */

    /** Which modules are on. `null` means "defer to the environment". */
    features: {
      funnels: { type: Boolean, default: null },
      email: { type: Boolean, default: null },
      gamification: { type: Boolean, default: null },
    },

    payments: {
      // The Razorpay key id is public by design — it ships in the client bundle
      // — so it is stored in the clear. The other two never leave the server.
      razorpayKeyId: String,
      razorpayKeySecretEnc: { type: String, select: false },
      razorpayWebhookSecretEnc: { type: String, select: false },
      upiVpa: String,
      upiPayeeName: String,
      invoicePrefix: String,
    },

    mail: {
      resendApiKeyEnc: { type: String, select: false },
      from: String,
    },

    video: {
      bunnyLibraryId: String,
      bunnySecurityKeyEnc: { type: String, select: false },
      bunnyApiKeyEnc: { type: String, select: false },
      bunnyWebhookTokenEnc: { type: String, select: false },
    },

    /**
     * The business identity that goes on invoices, policy pages and the footer
     * of every transactional email. Also CFG-3: these are the fields Razorpay's
     * KYC review rejects when they read as placeholders.
     */
    business: {
      legalName: String,
      address: String,
      supportEmail: String,
      operatorEmail: String,
      phone: String,
      gstin: String,
      jurisdictionCity: String,
      grievanceOfficer: String,
    },
  },
  { timestamps: true },
)

settingSchema.statics.getSingleton = async function () {
  const existing = await this.findOne({ key: 'site' })
  return existing || this.create({ key: 'site' })
}

export default mongoose.model('Setting', settingSchema)
