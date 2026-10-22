import mongoose from 'mongoose'

/** Media Library entries are separate from posts so one upload can be reused
 * as a featured image, an in-article image or an Open Graph image. */
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true, index: true },
    size: { type: Number, required: true },
    /** The four fields WordPress's Attachment Details panel edits. */
    title: { type: String, default: '' },
    altText: { type: String, default: '' },
    caption: { type: String, default: '' },
    description: { type: String, default: '' },
    uploadedBy: { type: String, default: 'Admin' },

    /**
     * Where the bytes actually live.
     *
     * 'bunny' means the object is in the Bunny Storage zone at `path`, and
     * `url` is an absolute CDN address. 'local' means it is on the server's own
     * disk at `filename`, served from /uploads/media. Both forms coexist: an
     * install that switches to Bunny keeps serving everything it uploaded
     * before, and deleting an item has to know which one it is looking at.
     */
    storage: { type: String, enum: ['local', 'bunny'], default: 'local', index: true },
    /** The object path inside the storage zone. Empty for local files. */
    path: { type: String, default: '' },

    /** The original's pixel dimensions. 0 when the format could not be read. */
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },

    /**
     * The derivatives, as WordPress makes them — see services/imageSizes.js.
     *
     * Only sizes the original was actually big enough for exist here, so the
     * editor's Size dropdown can offer exactly what is available rather than
     * listing options that would resolve to an upscaled blur.
     */
    sizes: [
      {
        _id: false,
        name: { type: String, required: true },
        width: Number,
        height: Number,
        url: String,
        path: String,
        size: Number,
      },
    ],
  },
  { timestamps: true },
)

mediaSchema.index({ createdAt: -1 })

export default mongoose.model('Media', mediaSchema)
