// Emits the hand-written half of the schema: CHECK constraints for every
// enum-typed text column, the auth.users foreign key, and RLS lockdown.
// Drizzle's text({ enum }) only types the column in JS; without these the
// database would accept any string a buggy route wrote.
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../src/db/schema/index.js'

const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const q = (v) => `'${v.replace(/'/g, "''")}'`
const out = []

const tables = Object.values(schema).filter((v) => v instanceof PgTable)
for (const table of tables) {
  const { name, columns } = getTableConfig(table)
  for (const col of columns) {
    if (!col.enumValues?.length || col.columnType !== 'PgText') continue
    const column = snake(col.name)
    out.push(
      `ALTER TABLE "${name}" ADD CONSTRAINT "${name}_${column}_check" CHECK ("${column}" IN (${col.enumValues.map(q).join(', ')}));`,
    )
  }
}

out.push(
  `ALTER TABLE "users" ADD CONSTRAINT "users_id_auth_users_fk" FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;`,
)

// Express is the only database client. RLS on with no policies means the anon
// and authenticated keys see nothing through PostgREST; the server connects as
// the postgres role, which bypasses RLS.
for (const table of tables) {
  out.push(`ALTER TABLE "${getTableConfig(table).name}" ENABLE ROW LEVEL SECURITY;`)
}

process.stdout.write(out.join('\n--> statement-breakpoint\n') + '\n')
