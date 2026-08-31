import mongoose from 'mongoose'

const postSchema = new mongoose.Schema(
  {
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    attachments: [{ kind: String, url: String, label: String }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export default mongoose.model('Post', postSchema)
