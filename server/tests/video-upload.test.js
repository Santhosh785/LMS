import crypto from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../src/config/env.js'
import { Course, Enrollment } from '../src/models/index.js'
import { agent, firstLessonId, paidCourse, signUp, signUpAdmin } from './helpers/factories.js'

/**
 * In-app video upload (task 22).
 *
 * The Bunny management API is stubbed at the fetch boundary — these tests
 * assert our side of the contract: who may mint an upload, what the presign
 * contains, how encoding status lands back on the lesson, and that a video
 * that is not `ready` never signs a playback URL.
 */

/** A paid course whose one video lesson has no video attached yet. */
const bareCourse = () =>
  paidCourse({
    sections: [{ name: 'M1', lessons: [{ name: 'Lesson one', contentType: 'Video' }] }],
  })

/**
 * fetch stub for video.bunnycdn.com. Routes on method+path, records calls so
 * tests can assert what left the building.
 */
function stubBunny({ createGuid = 'new-guid-123', video = { status: 4, length: 754 } } = {}) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opts = {}) => {
      const method = opts.method || 'GET'
      calls.push({ url: String(url), method, headers: opts.headers })
      const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' })
      if (method === 'POST') return ok({ guid: createGuid })
      if (method === 'DELETE') return ok({})
      return ok(video)
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

const videoPath = (course, lessonId) => `/api/admin/courses/${course._id}/lessons/${lessonId}/video`

describe('minting an upload', () => {
  it('refuses everyone below admin', async () => {
    const course = await bareCourse()
    const lessonId = firstLessonId(course)

    const anon = await agent().post(videoPath(course, lessonId))
    expect(anon.status).toBe(401)

    const { cookie } = await signUp()
    const student = await agent().post(videoPath(course, lessonId)).set('Cookie', cookie)
    expect(student.status).toBe(403)
  })

  it('creates the Bunny video and returns a TUS presign, never the API key', async () => {
    const calls = stubBunny()
    const course = await bareCourse()
    const lessonId = firstLessonId(course)
    const { cookie } = await signUpAdmin()

    const res = await agent().post(videoPath(course, lessonId)).set('Cookie', cookie)

    expect(res.status).toBe(201)
    expect(res.body.videoId).toBe('new-guid-123')
    expect(res.body.tus.endpoint).toBe('https://video.bunnycdn.com/tusupload')

    // The signature is exactly Bunny's TUS scheme, derived server-side.
    const { AuthorizationSignature, AuthorizationExpire, VideoId, LibraryId } = res.body.tus.headers
    expect(VideoId).toBe('new-guid-123')
    expect(String(LibraryId)).toBe('999999')
    expect(AuthorizationExpire).toBeGreaterThan(Date.now() / 1000)
    const expected = crypto
      .createHash('sha256')
      .update(`999999test-bunny-api-key${AuthorizationExpire}new-guid-123`)
      .digest('hex')
    expect(AuthorizationSignature).toBe(expected)
    expect(res.text).not.toContain('test-bunny-api-key')

    // The create call carried the key to Bunny — and only to Bunny.
    expect(calls[0].url).toContain('/library/999999/videos')
    expect(calls[0].headers.AccessKey).toBe('test-bunny-api-key')

    const saved = await Course.findById(course._id)
    expect(saved.sections[0].lessons[0].bunnyVideoId).toBe('new-guid-123')
    expect(saved.sections[0].lessons[0].videoStatus).toBe('uploading')
  })

  it('re-posting replaces: new GUID pinned, old video deleted best-effort', async () => {
    const calls = stubBunny({ createGuid: 'replacement-guid' })
    const course = await paidCourse() // lesson already carries video-guid-one
    const lessonId = firstLessonId(course)
    const { cookie } = await signUpAdmin()

    const res = await agent().post(videoPath(course, lessonId)).set('Cookie', cookie)
    expect(res.status).toBe(201)

    const saved = await Course.findById(course._id)
    expect(saved.sections[0].lessons[0].bunnyVideoId).toBe('replacement-guid')

    // The delete is fire-and-forget after the new GUID commits.
    await vi.waitFor(() => {
      const del = calls.find((c) => c.method === 'DELETE')
      expect(del?.url).toContain('video-guid-one')
    })
  })

  it('answers 503 when the management key is missing, not a stack trace', async () => {
    const course = await bareCourse()
    const { cookie } = await signUpAdmin()
    const saved = env.bunnyApiKey
    env.bunnyApiKey = ''
    try {
      const res = await agent()
        .post(videoPath(course, firstLessonId(course)))
        .set('Cookie', cookie)
      expect(res.status).toBe(503)
      expect(res.body.details.code).toBe('UPLOAD_UNCONFIGURED')
    } finally {
      // eslint-disable-next-line require-atomic-updates -- sequential test, no concurrent writer
      env.bunnyApiKey = saved
    }
  })
})

describe('encoding status', () => {
  it('polling flips processing → ready and fills the duration', async () => {
    stubBunny({ video: { status: 4, length: 754 } })
    const course = await paidCourse()
    const lessonId = firstLessonId(course)
    await Course.updateOne(
      { _id: course._id },
      { $set: { 'sections.0.lessons.0.videoStatus': 'processing' } },
    )
    const { cookie } = await signUpAdmin()

    const res = await agent().get(videoPath(course, lessonId)).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.videoStatus).toBe('ready')
    expect(res.body.durationSeconds).toBe(754)

    const saved = await Course.findById(course._id)
    expect(saved.sections[0].lessons[0].videoStatus).toBe('ready')
    expect(saved.sections[0].lessons[0].videoDurationSeconds).toBe(754)
    expect(saved.sections[0].lessons[0].duration).toBe('12:34')
  })

  it('the webhook needs the exact token', async () => {
    const course = await paidCourse()
    await Course.updateOne(
      { _id: course._id },
      { $set: { 'sections.0.lessons.0.videoStatus': 'processing' } },
    )

    const res = await agent()
      .post('/api/webhooks/bunny?token=wrong-token')
      .send({ VideoLibraryId: 999999, VideoGuid: 'video-guid-one', Status: 3 })

    expect(res.status).toBe(401)
    const saved = await Course.findById(course._id)
    expect(saved.sections[0].lessons[0].videoStatus).toBe('processing')
  })

  it('a valid webhook re-reads the authoritative status and marks ready', async () => {
    stubBunny({ video: { status: 4, length: 90 } })
    const course = await paidCourse()
    await Course.updateOne(
      { _id: course._id },
      { $set: { 'sections.0.lessons.0.videoStatus': 'processing' } },
    )

    const res = await agent()
      .post('/api/webhooks/bunny?token=test-bunny-webhook-token')
      .send({ VideoLibraryId: 999999, VideoGuid: 'video-guid-one', Status: 3 })

    expect(res.status).toBe(200)
    const saved = await Course.findById(course._id)
    expect(saved.sections[0].lessons[0].videoStatus).toBe('ready')
    expect(saved.sections[0].lessons[0].videoDurationSeconds).toBe(90)
  })

  it('acknowledges a video it no longer tracks instead of inviting retries', async () => {
    stubBunny()
    const res = await agent()
      .post('/api/webhooks/bunny?token=test-bunny-webhook-token')
      .send({ VideoLibraryId: 999999, VideoGuid: 'guid-of-a-deleted-lesson', Status: 3 })
    expect(res.status).toBe(200)
  })
})

describe('playback while not ready', () => {
  const playback = (slug, lessonId, cookie) =>
    agent().get(`/api/enrollments/course/${slug}/playback/${lessonId}`).set('Cookie', cookie)

  const enrolledOn = async (patch) => {
    const course = await paidCourse()
    await Course.updateOne({ _id: course._id }, { $set: patch })
    const { cookie, user } = await signUp()
    await Enrollment.create({ userId: user._id, courseId: course._id, source: 'paid' })
    return { course, cookie }
  }

  it('a processing video signs nothing', async () => {
    const { course, cookie } = await enrolledOn({
      'sections.0.lessons.0.videoStatus': 'processing',
    })
    const res = await playback(course.slug, firstLessonId(course), cookie)
    expect(res.status).toBe(409)
    expect(res.body.details.code).toBe('VIDEO_PROCESSING')
    expect(res.text).not.toContain('mediadelivery')
  })

  it('a failed video signs nothing', async () => {
    const { course, cookie } = await enrolledOn({ 'sections.0.lessons.0.videoStatus': 'failed' })
    const res = await playback(course.slug, firstLessonId(course), cookie)
    expect(res.status).toBe(409)
    expect(res.body.details.code).toBe('VIDEO_FAILED')
    expect(res.text).not.toContain('mediadelivery')
  })

  it('a legacy GUID with no status still plays — and reads as ready', async () => {
    const { course, cookie } = await enrolledOn({})
    const res = await playback(course.slug, firstLessonId(course), cookie)
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('mediadelivery')

    const tree = await agent().get(`/api/enrollments/course/${course.slug}`).set('Cookie', cookie)
    expect(tree.body.course.sections[0].lessons[0].videoStatus).toBe('ready')
    expect(tree.text).not.toContain('video-guid-one')
  })
})

describe('removing a video', () => {
  it('deletes in Bunny and clears the lesson', async () => {
    const calls = stubBunny()
    const course = await paidCourse()
    const lessonId = firstLessonId(course)
    const { cookie } = await signUpAdmin()

    const res = await agent().delete(videoPath(course, lessonId)).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('video-guid-one'))).toBe(true)
    const saved = await Course.findById(course._id)
    expect(saved.sections[0].lessons[0].bunnyVideoId).toBeUndefined()
    expect(saved.sections[0].lessons[0].videoStatus).toBeUndefined()
  })
})
