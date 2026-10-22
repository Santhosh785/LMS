import { sql } from 'drizzle-orm'
import { db, closeDb } from '../db/index.js'
import { describeTarget } from '../utils/dbTarget.js'

/**
 * Proves the pool can reach Postgres before the server starts listening. The
 * pool itself connects lazily, so without this a bad DATABASE_URL would only
 * surface on the first request — as a 500 a visitor sees.
 */
export async function connectDb() {
  await db.execute(sql`select 1`)
  // Never the raw URL: it carries the database password, and this line ends up
  // in server logs, CI output and over-the-shoulder screenshots.
  console.log(`[db] connected to ${describeTarget()}`)
}

export async function disconnectDb() {
  await closeDb()
}
