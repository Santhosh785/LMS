import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { Button } from '../ui/index.jsx'

/**
 * The video frame for one lesson.
 *
 * Signed Bunny URLs expire in about 15 minutes (task 8). A student who pauses to
 * take a call and comes back must not find a dead player, so this re-requests a
 * fresh URL slightly before the old one lapses instead of waiting for playback
 * to break. Nothing is ever persisted: a signed URL in localStorage would
 * outlive the session it was issued for and is exactly what the short TTL exists
 * to prevent.
 */

/** Refresh this long before expiry, so the swap happens while the URL is live. */
const REFRESH_MARGIN_MS = 60 * 1000

/** Content types other than Video are out of scope — say so honestly. */
const TYPE_COPY = {
  Audio: [
    '🎧',
    'Audio lesson',
    'This lesson is audio. Playback for audio lessons is not available yet.',
  ],
  'E-book': [
    '📘',
    'E-book',
    'This lesson is an e-book. Downloads are not available in this build yet.',
  ],
  PDF: ['📄', 'PDF', 'This lesson is a PDF. Downloads are not available in this build yet.'],
  Text: [
    '📝',
    'Text lesson',
    'This lesson is written material. Reading it in the player is not available yet.',
  ],
  Downloads: [
    '📦',
    'Downloads',
    'This lesson is a downloadable pack. Downloads are not available in this build yet.',
  ],
  Quiz: ['🧠', 'Quiz', 'This lesson is a quiz. Quizzes are not available in this build yet.'],
  Survey: ['📊', 'Survey', 'This lesson is a survey. Surveys are not available in this build yet.'],
  Assignment: [
    '✍️',
    'Assignment',
    'This lesson is an assignment. Assignments are not available in this build yet.',
  ],
  Live: [
    '🔴',
    'Live session',
    'This lesson runs live. Check the Live tab for the schedule and join link.',
  ],
  'Custom Code': ['🧩', 'Custom content', 'This lesson type is not available in this build yet.'],
  'SCORM/HTML': ['🧩', 'SCORM package', 'This lesson type is not available in this build yet.'],
}

function Frame({ children, className = '' }) {
  return (
    <div
      className={`relative grid aspect-video place-items-center overflow-hidden rounded-lg2 bg-brand-deep ${className}`}
    >
      {children}
    </div>
  )
}

function Notice({ icon, title, body, action }) {
  return (
    <Frame>
      <div className="px-6 text-center text-white">
        <span className="text-3xl" aria-hidden="true">
          {icon}
        </span>
        <p className="mt-2 text-[1rem] font-semibold">{title}</p>
        {body && (
          <p className="mx-auto mt-1 max-w-sm text-[0.85rem] leading-relaxed text-white/70">
            {body}
          </p>
        )}
        {action}
      </div>
    </Frame>
  )
}

export default function LessonPlayer({ slug, lesson, thumbClass }) {
  const [state, setState] = useState({ status: 'idle', url: null, error: null })
  const timer = useRef(null)
  /** Always the current `load`, so the refresh timer cannot fire a stale one. */
  const reload = useRef(null)
  const lessonId = lesson?._id ? String(lesson._id) : null
  const contentType = lesson?.contentType || 'Video'
  const isVideo = contentType === 'Video'

  const load = useCallback(async () => {
    if (!lessonId) return
    setState((s) => ({ status: s.url ? 'refreshing' : 'loading', url: s.url, error: null }))
    try {
      const { data } = await api.get(
        `/enrollments/course/${slug}/playback/${encodeURIComponent(lessonId)}`,
      )
      setState({ status: 'ready', url: data.url, error: null })

      // Schedule the next fetch from the expiry the server reported, rather than
      // assuming the TTL — the server owns that number and may change it.
      //
      // Scheduled through a ref rather than by naming `load` inside itself: a
      // self-referencing useCallback captures whichever binding existed when it
      // was created, so a later render's `load` — with a new lesson id — would
      // never be the one the timer fires.
      clearTimeout(timer.current)
      const due = new Date(data.expiresAt).getTime() - Date.now() - REFRESH_MARGIN_MS
      timer.current = setTimeout(() => reload.current?.(), Math.max(30_000, due))
    } catch (err) {
      setState({
        status: 'error',
        url: null,
        error: { code: err?.response?.data?.details?.code, message: apiError(err) },
      })
    }
  }, [slug, lessonId])

  // Written in an effect, not during render: a ref mutated while rendering is
  // invisible to React and breaks under concurrent rendering, where a render can
  // be started and thrown away.
  useEffect(() => {
    reload.current = load
  }, [load])

  // A fresh URL per lesson, fetched only for the lesson actually being watched —
  // requesting all of them up front would hand out a playable link for the whole
  // course in one go.
  useEffect(() => {
    clearTimeout(timer.current)
    if (!lessonId || !isVideo) {
      setState({ status: 'idle', url: null, error: null })
      return
    }
    load()
    return () => clearTimeout(timer.current)
  }, [lessonId, isVideo, load])

  if (!lesson) {
    return (
      <Notice
        icon="🎬"
        title="Pick a lesson"
        body="Choose a lesson from the course content to begin."
      />
    )
  }

  if (!isVideo) {
    const [icon, title, body] = TYPE_COPY[contentType] || [
      '🧩',
      contentType,
      'This lesson type is not available in this build yet.',
    ]
    return <Notice icon={icon} title={title} body={body} />
  }

  if (state.status === 'error') {
    const { code, message } = state.error
    // NOT_ENROLLED and ACCESS_EXPIRED mean different things to the person
    // reading them: one needs to buy, the other needs to renew. Task 6 returns
    // them as distinct codes precisely so this screen can tell them apart.
    if (code === 'ACCESS_EXPIRED') {
      return (
        <Notice
          icon="⌛"
          title="Your access has expired"
          body="This course was on a time-limited plan and the window has closed. Renew to pick up where you left off."
          action={
            <Button to={`/checkout/${slug}`} size="sm" variant="light" className="mt-4">
              Renew access
            </Button>
          }
        />
      )
    }
    if (code === 'NOT_ENROLLED') {
      return (
        <Notice
          icon="🔒"
          title="You are not enrolled in this course"
          action={
            <Button to={`/courses/${slug}`} size="sm" variant="light" className="mt-4">
              View the course
            </Button>
          }
        />
      )
    }
    if (code === 'VIDEO_NOT_ATTACHED') {
      return (
        <Notice
          icon="🎬"
          title="This lesson has no video yet"
          body="It will appear here once it is uploaded."
        />
      )
    }
    // Task 22: a video exists but Bunny has not finished encoding it — a state
    // students can now see, since lessons appear the moment an upload starts.
    if (code === 'VIDEO_PROCESSING') {
      return (
        <Notice
          icon="⏳"
          title="This video is almost ready"
          body="It has been uploaded and is being processed. Check back in a few minutes."
          action={
            <Button size="sm" variant="light" className="mt-4" onClick={load}>
              Check again
            </Button>
          }
        />
      )
    }
    if (code === 'VIDEO_FAILED') {
      return (
        <Notice
          icon="🛠"
          title="This video is temporarily unavailable"
          body="We know about it and are re-publishing the lesson. Please check back soon."
        />
      )
    }
    return (
      <Notice
        icon="⚠️"
        title="Video could not be loaded"
        body={message}
        action={
          <Button size="sm" variant="light" className="mt-4" onClick={load}>
            Try again
          </Button>
        }
      />
    )
  }

  if (!state.url) {
    return (
      <Frame>
        <div className={`absolute inset-0 opacity-40 ${thumbClass || ''}`} aria-hidden="true" />
        <p className="relative animate-pulse2 text-[0.9rem] font-semibold text-white/90">
          Loading video…
        </p>
      </Frame>
    )
  }

  return (
    <Frame>
      {/*
        Keyed on the URL so a refreshed signature actually remounts the iframe;
        without it React reuses the element and the player keeps the stale src.
        The same key is why switching lessons cannot leave the previous video
        playing underneath the new one.
      */}
      <iframe
        key={state.url}
        src={state.url}
        title={lesson.name}
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </Frame>
  )
}
