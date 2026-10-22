import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Migrations run over the direct connection: the transaction-mode pooler cannot
// hold the session-level state drizzle-kit's migrator relies on.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.js',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '',
  },
})
