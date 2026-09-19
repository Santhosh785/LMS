import mongoose from 'mongoose'

/** Public comments are held for moderation by default. Email is retained only
 * for moderation context and is never returned by the public endpoint. */
const blogCommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true, index: true },
    /** An admin reply threads under the comment it answers. */
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogComment', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    website: { type: String, trim: true, maxlength: 254, default: '' },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    /**
     * Trash mirrors the posts list: a moderator can undo a mis-click, and
     * "Delete permanently" stays a separate, deliberate second step.
     */
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Spam', 'Trash'],
      default: 'Pending',
      index: true,
    },
    statusBeforeTrash: String,
    /** Replies written from the moderation screen are labelled in both lists. */
    byAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
)

blogCommentSchema.index({ postId: 1, status: 1, createdAt: -1 })
blogCommentSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('BlogComment', blogCommentSchema)
