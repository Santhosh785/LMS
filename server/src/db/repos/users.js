import { eq, sql } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { isUuid } from '../coerce.js'
import { initialsFor, users } from '../schema/index.js'
import { supabaseAdmin } from '../../services/supabaseAdmin.js'

/**
 * Accounts: one Supabase Auth identity (credentials) plus one `users` row
 * (profile and role), sharing an id.
 *
 * Creating both is two systems and cannot be one transaction, so the order is
 * fixed and the failure cases are closed explicitly: the auth identity first,
 * then the profile; if the profile insert fails the identity is deleted again.
 * An identity that exists without a profile (a crash between the two) is
 * adopted on the next attempt rather than reported as "email taken".
 */

const SECRET_COLUMNS = ['passwordResetTokenHash', 'passwordResetExpiresAt']

/** A profile row safe to hand to route code: no token columns, `_id` alias. */
export function profile(row) {
  if (!row) return null
  const out = { ...row }
  for (const k of SECRET_COLUMNS) delete out[k]
  return withMongoId(out)
}

export const normaliseEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase()

export async function findUserById(id, { tx = db } = {}) {
  if (!isUuid(id)) return null
  const [row] = await tx.select().from(users).where(eq(users.id, id))
  return profile(row)
}

export async function findUserByEmail(email, { tx = db } = {}) {
  const [row] = await tx
    .select()
    .from(users)
    .where(eq(users.email, normaliseEmail(email)))
  return profile(row)
}

/** The auth.users id for an email, whether or not a profile exists for it. */
async function authIdForEmail(email, tx = db) {
  const { rows } = await tx.execute(
    sql`select id from auth.users where lower(email) = ${normaliseEmail(email)} limit 1`,
  )
  return rows[0]?.id || null
}

export class EmailTakenError extends Error {
  constructor() {
    super('An account with that email already exists')
    this.code = 'EMAIL_TAKEN'
  }
}

/**
 * Creates an account. `password` may be omitted for an account made on
 * someone's behalf (a UPI buyer): the identity then has no password at all, and
 * the set-password email is the only way in.
 */
export async function createAccount({ email, password, name, role = 'student', ...rest }) {
  const address = normaliseEmail(email)
  if (await findUserByEmail(address)) throw new EmailTakenError()

  let id = await authIdForEmail(address)
  let createdIdentity = false
  if (!id) {
    const { data, error } = await supabaseAdmin().auth.admin.createUser({
      email: address,
      ...(password ? { password } : {}),
      email_confirm: true,
    })
    if (error) {
      if (/already (been )?registered|exists/i.test(error.message)) throw new EmailTakenError()
      throw new Error(`Supabase createUser failed: ${error.message}`)
    }
    id = data.user.id
    createdIdentity = true
  } else if (password) {
    // Adopting an orphaned identity: make it answer to the password just chosen.
    await supabaseAdmin().auth.admin.updateUserById(id, { password })
  }

  const displayName = (name || address.split('@')[0]).trim()
  try {
    const [row] = await db
      .insert(users)
      .values({
        id,
        email: address,
        name: displayName,
        role,
        avatarInitials: initialsFor(displayName),
        ...pickProfile(rest),
      })
      .returning()
    return profile(row)
  } catch (err) {
    if (createdIdentity)
      await supabaseAdmin()
        .auth.admin.deleteUser(id)
        .catch(() => {})
    if (err.code === '23505') throw new EmailTakenError()
    throw err
  }
}

const PROFILE_FIELDS = [
  'phone',
  'education',
  'currentProfile',
  'preferredLanguage',
  'weeklyGoalHours',
  'name',
]

function pickProfile(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([k, v]) => PROFILE_FIELDS.includes(k) && v !== undefined),
  )
}

export async function updateProfile(id, patch) {
  const values = pickProfile(patch)
  if (values.name) values.avatarInitials = initialsFor(values.name)
  if (!Object.keys(values).length) return findUserById(id)
  const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning()
  return profile(row)
}

/** Deletes the identity; the profile row goes with it via the FK cascade. */
export async function deleteAccount(id) {
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id)
  if (error && !/not found/i.test(error.message)) throw new Error(error.message)
  await db.delete(users).where(eq(users.id, id))
}
