/**
 * Apply youth profiling SQL to a remote Supabase Postgres database.
 *
 * Requires one of:
 *   SUPABASE_DB_URL   (preferred — Database settings → Connection string URI)
 *   DATABASE_URL
 *
 * Example:
 *   $env:SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-....pooler.supabase.com:6543/postgres"
 *   node scripts/apply-youth-sql.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || ''

if (!dbUrl) {
  console.error(`
Cannot apply SQL automatically: no database URL is configured.

This workspace has no .env with Supabase credentials, and the Supabase CLI
cannot reach your remote project without login + project link / DB password.

To apply now, set the connection string then re-run:

  PowerShell:
    $env:SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres"
    node scripts/apply-youth-sql.mjs

Or paste these files in the Supabase SQL Editor when you can open the account:
  1) supabase/youth-profiling.sql
  2) supabase/youth-profiling-pwd.sql  (only if the table already existed without PWD)
`)
  process.exit(1)
}

const files = [
  'supabase/youth-profiling.sql',
  'supabase/youth-profiling-pwd.sql',
  'supabase/youth-profiling-addresses.sql',
]
  .map((rel) => resolve(root, rel))
  .filter((file) => existsSync(file))

function runWithPsql(url, file) {
  const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8',
    shell: true,
  })
  return result
}

let applied = 0
for (const file of files) {
  console.log(`Applying ${file} ...`)
  const result = runWithPsql(dbUrl, file)
  if (result.error && result.error.code === 'ENOENT') {
    console.error(`
psql is not installed on this machine.
Install PostgreSQL client tools, or open the Supabase SQL Editor and paste the SQL files.
`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(result.stdout || '')
    console.error(result.stderr || '')
    process.exit(result.status || 1)
  }
  applied += 1
  console.log(`OK: ${file}`)
}

console.log(`Done. Applied ${applied} SQL file(s).`)
