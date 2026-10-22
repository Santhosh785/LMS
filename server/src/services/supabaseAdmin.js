import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

/**
 * Supabase Auth, server side only.
 *
 * Holds the secret (service role) key, so nothing under client/ may ever import
 * this — the browser never talks to Supabase at all; it talks to Express, which
 * talks to Supabase on its behalf. `persistSession: false` because a server has
 * no session of its own: every call is either an admin call or made on behalf of
 * one request's user.
 */
const options = { auth: { persistSession: false, autoRefreshToken: false } }

let admin = null

export function supabaseAdmin() {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  if (!admin) admin = createClient(env.supabase.url, env.supabase.serviceRoleKey, options)
  return admin
}

/**
 * A throwaway client for user-scoped calls (password sign-in, refresh). Kept
 * separate from the admin client so one request's session can never leak into
 * another's — the admin singleton must stay sessionless.
 */
export const supabaseForRequest = () =>
  createClient(env.supabase.url, env.supabase.serviceRoleKey, options)
