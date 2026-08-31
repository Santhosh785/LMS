import mongoose from 'mongoose'

/**
 * Lessons and sections are embedded: they are only ever read/written through
 * their parent course, and the admin curriculum editor saves the whole tree.
 * The public course page labels a Section a "Module" — same document.
 */
const lessonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    duration: String,
    /**
     * Legacy free-text URL. Kept so documents written before Bunny signing still
     * load; nothing serves it to a student. New content uses `bunnyVideoId`.
     */
    videoUrl: String,
    /**
     * Bunny Stream GUID for this lesson. The server signs a short-lived embed
     * URL from it per request (see services/bunny.js) — it is never handed to
     * the client as-is, and never stored signed.
     */
    bunnyVideoId: { type: String, trim: true },
    /**
     * Where the in-app upload pipeline (task 22) left this video.
     * Unset means the GUID was attached by hand from the Bunny dashboard —
     * historically only done after encoding finished — so unset + a GUID reads
     * as `ready` (see effectiveVideoStatus in services/bunny.js).
     *
     *   uploading  — video object created in Bunny, browser TUS upload underway
     *   processing — upload complete, Bunny transcoding
     *   ready      — every resolution playable
     *   failed     — encoding or upload failed; needs a re-upload
     */
    videoStatus: { type: String, enum: ['uploading', 'processing', 'ready', 'failed'] },
    /** Set from Bunny's `length` when encoding finishes. Source for `duration`. */
    videoDurationSeconds: Number,
    contentType: {
      type: String,
      enum: [
        'Video',
        'Audio',
        'E-book',
        'PDF',
        'Text',
        'Downloads',
        'Quiz',
        'Survey',
        'Assignment',
        'Live',
        'Custom Code',
        'SCORM/HTML',
      ],
      default: 'Video',
    },
    isFreePreview: { type: Boolean, default: false },
    isDraft: { type: Boolean, default: false },
    isCompulsory: { type: Boolean, default: false },
    enableDiscussion: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
)

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    // public course-detail fields
    duration: String,
    difficulty: String,
    keyTopics: [String],
    industryRelevance: [String],
    lessons: [lessonSchema],
  },
  { _id: true },
)

const pricingPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    compareAtPrice: Number,
    access: { type: String, enum: ['Lifetime', '12 months', '6 months'], default: 'Lifetime' },
  },
  { _id: true },
)

const dripRuleSchema = new mongoose.Schema(
  {
    sectionId: mongoose.Schema.Types.ObjectId,
    sectionName: String,
    releaseType: {
      type: String,
      enum: ['Immediately on enroll', 'After previous complete or'],
      default: 'Immediately on enroll',
    },
    delayDays: { type: Number, default: 0 },
  },
  { _id: true },
)

const automationRuleSchema = new mongoose.Schema(
  {
    trigger: {
      type: String,
      enum: ['OnEnroll', 'OnLessonComplete', 'OnCourseComplete'],
      default: 'OnEnroll',
    },
    action: {
      type: String,
      enum: ['Send email sequence', 'Add tag', 'Webhook'],
      default: 'Send email sequence',
    },
    delay: { type: String, default: 'Immediate' },
    enabled: { type: Boolean, default: true },
  },
  { _id: true },
)

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    // catalog filter facets — these mirror the data-* attributes on the old cards
    topic: { type: String, index: true },
    languages: [String],
    /*
     * Names, not ids, and governed by the Term registry — see models/Term.js.
     * `topic` stays the catalogue's primary facet because its URL contract is
     * public; categories and tags are the editable classification layered on top.
     */
    categories: { type: [String], index: true, default: [] },
    tags: { type: [String], index: true, default: [] },
    price: { type: String, enum: ['paid', 'free'], default: 'paid', index: true },
    type: { type: String, enum: ['self', 'combo', 'starter'], default: 'self', index: true },
    rating: { type: Number, default: 0 },
    hours: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    strikeAmount: Number,
    popularity: { type: Number, default: 0 },
    newestRank: { type: Number, default: 0 },
    enrolledCount: { type: Number, default: 0 },
    enrolledLabel: String,
    // presentation
    /**
     * Optional cover image. The design ships with a coloured gradient
     * (`thumbClass`) and the title drawn over it, carried over from the static
     * site — that stays the fallback, so leaving this empty changes nothing and
     * a broken URL degrades to the gradient rather than a broken-image icon.
     */
    image: String,
    imageAlt: String,
    thumbClass: { type: String, default: 'media-seo' },
    mediaLabel: String,
    kind: String,
    // course-detail content
    summary: String,
    overview: [String],
    journey: [{ step: String, title: String, body: String }],
    tools: [String],
    careers: [String],
    whoShouldEnroll: { intro: String, points: [String] },
    faqs: [{ q: String, a: String }],
    sections: [sectionSchema],
    // admin-managed
    durationLabel: String,
    status: { type: String, enum: ['Published', 'Draft'], default: 'Published', index: true },
    visibility: { type: String, enum: ['Public', 'Hidden'], default: 'Public' },
    pricingPlans: [pricingPlanSchema],
    dripEnabled: { type: Boolean, default: false },
    dripSchedule: [dripRuleSchema],
    automationRules: [automationRuleSchema],
    drmEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
)

courseSchema.virtual('moduleCount').get(function () {
  return this.sections?.length || 0
})

courseSchema.set('toJSON', { virtuals: true })
courseSchema.set('toObject', { virtuals: true })

export default mongoose.model('Course', courseSchema)
