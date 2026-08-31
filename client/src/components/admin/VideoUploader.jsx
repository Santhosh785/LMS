import { useEffect, useRef, useState } from 'react'
import * as tus from 'tus-js-client'
import { api, apiError } from '../../api/client.js'
import { Button, cn } from '../ui/index.jsx'

/**
 * Lesson video upload (task 22).
 *
 * The file goes browser → Bunny directly over TUS: the server only mints the
 * video object and a per-video upload signature, so a 2GB lecture never
 * transits (or is buffered by) our API, and a dropped connection resumes from
 * where it died instead of restarting.
 *
 * State machine, driven by `lesson.videoStatus` plus local upload progress:
 *
 *   none ── pick file ──▶ uploading ──▶ processing ──▶ ready
 *                             │              │            │ Replace / Remove
 *                             ▼              ▼
 *                          (cancel)       failed ── Try again ──▶ uploading
 *
 * Every server-side transition is mirrored into the curriculum editor's local
 * state via `onPatch`, so clicking "Save curriculum" afterwards writes the
 * same values back rather than clobbering them with stale ones.
 */

const POLL_MS = 8000

const effectiveStatus = (lesson) => lesson.videoStatus || (lesson.bunnyVideoId ? 'ready' : 'none')

const fmtBytes = (n) => {
  if (!Number.isFinite(n)) return ''
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  return `${Math.round(n / 1e3)} KB`
}

const fmtDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

const STATUS_CHIP = {
  ready: { label: 'Ready', cls: 'bg-accent-soft text-brand' },
  processing: { label: 'Processing…', cls: 'bg-amber-50 text-warn-admin' },
  uploading: { label: 'Uploading…', cls: 'bg-amber-50 text-warn-admin' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-danger-admin' },
}

export function VideoStatusChip({ lesson }) {
  const status = effectiveStatus(lesson)
  const chip = STATUS_CHIP[status]
  if (!chip) return null
  return (
    <span
      className={cn('shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold', chip.cls)}
    >
      {chip.label}
    </span>
  )
}

export default function VideoUploader({ courseId, lesson, onPatch }) {
  const status = effectiveStatus(lesson)
  const [progress, setProgress] = useState(null) // { sent, total } while a tus upload runs
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const uploadRef = useRef(null)
  const fileInputRef = useRef(null)

  const base = `/admin/courses/${courseId}/lessons/${lesson._id}/video`

  /**
   * Poll while Bunny owns the state. Also covers 'uploading' with no live tus
   * upload in this tab — a reload mid-upload lands there, and the admin
   * recovers by picking the file again (the POST replaces the dead video).
   */
  useEffect(() => {
    if (!lesson._id) return undefined
    if (status !== 'processing' && !(status === 'uploading' && !uploadRef.current)) {
      return undefined
    }
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(base)
        if (data.videoStatus !== status) {
          const patch = { videoStatus: data.videoStatus }
          if (data.videoStatus === 'ready' && data.durationSeconds) {
            patch.videoDurationSeconds = data.durationSeconds
            // Mirror the server's auto-fill so a later save doesn't undo it.
            if (!lesson.duration || lesson.duration === '00:00') {
              patch.duration = fmtDuration(data.durationSeconds)
            }
          }
          onPatch(patch)
        }
      } catch {
        /* transient — next tick retries */
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [base, status, lesson._id, lesson.duration, onPatch])

  const startUpload = async (file) => {
    setError('')
    setBusy(true)
    try {
      const { data } = await api.post(base)
      onPatch({ bunnyVideoId: data.videoId, videoStatus: 'uploading' })

      const upload = new tus.Upload(file, {
        endpoint: data.tus.endpoint,
        headers: data.tus.headers,
        metadata: { filetype: file.type, title: file.name },
        retryDelays: [0, 3000, 5000, 10000, 20000],
        onProgress: (sent, total) => setProgress({ sent, total }),
        onError: (err) => {
          uploadRef.current = null
          setProgress(null)
          setError(`Upload failed: ${err?.message || 'connection lost'}. Pick the file to retry.`)
        },
        onSuccess: () => {
          uploadRef.current = null
          setProgress(null)
          // Bunny has the whole file; encoding starts now. The poll above
          // (and the webhook, server-side) carries it to ready.
          onPatch({ videoStatus: 'processing' })
        },
      })
      uploadRef.current = upload
      setProgress({ sent: 0, total: file.size })
      upload.start()
    } catch (err) {
      setError(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  const cancelUpload = async () => {
    const upload = uploadRef.current
    uploadRef.current = null
    setProgress(null)
    try {
      await upload?.abort(true) // true = also delete the partial from the TUS server
    } catch {
      /* already gone */
    }
    await removeVideo()
  }

  const removeVideo = async () => {
    setError('')
    setBusy(true)
    try {
      await api.delete(base)
      onPatch({ bunnyVideoId: '', videoStatus: undefined, videoDurationSeconds: undefined })
    } catch (err) {
      setError(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  const pickFile = () => fileInputRef.current?.click()

  // The presign endpoint addresses the lesson by id, which only exists after
  // the curriculum has been saved once — a brand-new row can't upload yet.
  if (!lesson._id) {
    return (
      <div className="rounded-lg2 border border-dashed border-line-admin bg-surface-admin/40 p-4 text-[0.84rem] text-muted-admin">
        Save the curriculum first, then upload this lesson's video.
      </div>
    )
  }

  const uploading = progress !== null
  const pct = uploading && progress.total ? Math.round((progress.sent / progress.total) * 100) : 0

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.85rem] font-semibold text-brand-deep">Lesson video</span>
        <VideoStatusChip lesson={lesson} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // same file re-selectable after a failure
          if (file) startUpload(file)
        }}
      />

      {uploading ? (
        <div className="rounded-lg2 border border-line-admin bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-[0.8rem] text-muted-admin">
            <span>
              Uploading — {fmtBytes(progress.sent)} of {fmtBytes(progress.total)}
            </span>
            <span className="font-semibold text-brand-deep">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-admin">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" onClick={cancelUpload}>
              Cancel upload
            </Button>
          </div>
        </div>
      ) : status === 'none' ? (
        <button
          type="button"
          onClick={pickFile}
          disabled={busy}
          className="grid place-items-center gap-1 rounded-lg2 border border-dashed border-line-admin bg-surface-admin/40 px-4 py-7 text-[0.85rem] text-muted-admin hover:border-brand hover:text-brand"
        >
          <span className="text-xl">🎬</span>
          <span className="font-semibold">Upload video</span>
          <span className="text-[0.75rem]">Goes straight to Bunny Stream — resumable</span>
        </button>
      ) : (
        <div className="rounded-lg2 border border-line-admin bg-white p-4">
          <div className="text-[0.8rem] text-muted-admin">
            {status === 'ready' && (
              <>
                Playable
                {lesson.videoDurationSeconds
                  ? ` · ${fmtDuration(lesson.videoDurationSeconds)}`
                  : ''}
                <span className="mt-1 block break-all text-[0.72rem]">{lesson.bunnyVideoId}</span>
              </>
            )}
            {status === 'processing' &&
              'Bunny is encoding this video. It becomes playable automatically — no need to stay on this page.'}
            {status === 'uploading' &&
              'An upload was started but has not finished. Pick the file again to restart it.'}
            {status === 'failed' &&
              'Encoding failed. Upload the file again, or try another format.'}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {status !== 'processing' && (
              <Button variant="outline" onClick={pickFile} disabled={busy}>
                {status === 'ready' ? 'Replace' : 'Upload again'}
              </Button>
            )}
            <Button variant="outline" onClick={removeVideo} disabled={busy}>
              Remove
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-[0.8rem] text-danger-admin">{error}</p>}
    </div>
  )
}
