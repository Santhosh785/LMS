import mongoose from 'mongoose'
import { env } from './env.js'
import { describeTarget } from '../utils/dbTarget.js'

export async function connectDb() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.mongoUri)
  // Never the raw URI: on Atlas it carries the database password, and this line
  // ends up in server logs, CI output and over-the-shoulder screenshots.
  console.log(`[db] connected to ${describeTarget()}`)
  return mongoose.connection
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
