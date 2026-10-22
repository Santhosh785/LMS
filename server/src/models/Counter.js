import mongoose from 'mongoose'

/**
 * Atomic sequence numbers. Currently one key: `invoice`.
 *
 * `Transaction.invoiceNo` has to be sequential with no gaps a tax inspector
 * would ask about, and "count the transactions and add one" races — two
 * approvals a second apart would both read the same count and mint the same
 * number. A single-document `$inc` is atomic in MongoDB, so concurrent callers
 * are handed distinct values without a lock.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
})

/** Returns the next value for `key`, creating the counter on first use. */
counterSchema.statics.next = async function (key) {
  const doc = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return doc.seq
}

export default mongoose.model('Counter', counterSchema)
