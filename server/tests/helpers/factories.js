import request from 'supertest'
import { eq } from 'drizzle-orm'
import app from '../../src/index.js'
import { db } from '../../src/db/index.js'
import { users } from '../../src/db/schema/index.js'
import { createCourse } from '../../src/db/repos/courses.js'
import { findUserByEmail } from '../../src/db/repos/users.js'

/**
 * Fixtures for the money-path tests.
 *
 * Assertions are written against observable behaviour — HTTP status, response
 * body, database state — so they survive a refactor of the code underneath.
 * These helpers exist to keep that possible without a wall of setup per test.
 */

export const agent = () => request(app)

export const PASSWORD = 'test-password-1234'

/** Every cookie a response set, as one Cookie header value. */
export const cookiesFrom = (res) =>
  (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ')

/**
 * Registers a user through the real endpoint (so through Supabase Auth) and
 * returns the session cookies plus the profile row.
 */
export async function signUp({ name = 'Test Student', email, role = 'student' } = {}) {
  const address =
    email || `student-${Date.now()}-${Math.round(performance.now() * 1000)}@example.in`
  const res = await agent()
    .post('/api/auth/register')
    .send({ name, email: address, password: PASSWORD })
    .expect(201)

  if (role !== 'student') await db.update(users).set({ role }).where(eq(users.email, address))

  return {
    cookie: cookiesFrom(res),
    user: await findUserByEmail(address),
    email: address,
  }
}

export const signUpAdmin = () =>
  signUp({ name: 'Test Admin', email: 'admin@example.in', role: 'admin' })

/** A published, paid course with one video lesson and a 12-month plan. */
export async function paidCourse(overrides = {}) {
  return createCourse({
    title: 'SEO Mastery',
    slug: 'seo-mastery',
    price: 'paid',
    amount: 2499,
    status: 'Published',
    visibility: 'Public',
    pricingPlans: [
      { name: '12 month access', price: 2499, access: '12 months' },
      { name: 'Lifetime access', price: 4999, access: 'Lifetime' },
    ],
    sections: [
      {
        name: 'Module 1',
        lessons: [
          { name: 'Lesson one', contentType: 'Video', bunnyVideoId: 'video-guid-one' },
          { name: 'A quiz', contentType: 'Quiz' },
        ],
      },
    ],
    ...overrides,
  })
}

export async function freeCourse(overrides = {}) {
  return createCourse({
    title: 'Free Starter',
    slug: 'free-starter',
    price: 'free',
    amount: 0,
    status: 'Published',
    visibility: 'Public',
    sections: [{ name: 'M1', lessons: [{ name: 'Intro', bunnyVideoId: 'free-guid' }] }],
    ...overrides,
  })
}

export const firstLessonId = (course) => String(course.sections[0].lessons[0]._id)
export const quizLessonId = (course) => String(course.sections[0].lessons[1]._id)

/** Walks the manual UPI checkout and returns the pending transaction id. */
export async function submitUpiPayment({
  slug = 'seo-mastery',
  name = 'Anjali R',
  email = 'anjali@example.in',
  phone = '9876543210',
  utr = '429518847213',
  plan,
} = {}) {
  const res = await agent().post('/api/checkout/upi').send({ slug, name, email, phone, utr, plan })
  return res
}
