# Bunny Stream — playback signing (task 8) & in-app upload (task 22)

Course videos live in Bunny Stream. The server never serves a video file; it
signs a short-lived embed URL per request and the browser loads it in Bunny's
iframe player. Since task 22, videos are also **uploaded** from inside the
admin curriculum editor — the file goes browser → Bunny directly over TUS, so
a 2GB lecture never transits this server and a dropped connection resumes
instead of restarting. See "Uploading from the admin" below.

## The manual step that makes it real

**Bunny dashboard → Stream → (the library) → Security → enable "Token
Authentication".**

Until that toggle is on, Bunny serves any video to anyone who has its GUID, and
the token this codebase computes is decorative. Signing is enforcement only in
combination with that setting — this is the single most important line in this
document.

While you are on that screen, also consider:

- **Allowed referrers** — restrict to the production domain so the embed cannot
  be framed from an arbitrary site.
- **Block direct URL access** — on.
- **Watermark** — optional, and appropriate at this price point. Real DRM
  (Widevine/FairPlay) is deliberately out of scope; signed expiring URLs plus a
  watermark is the right level.

## Configuration

`server/.env` (see `.env.example`):

```
BUNNY_LIBRARY_ID=123456          # Stream → library → the numeric ID
BUNNY_SECURITY_KEY=…             # Stream → library → Security → Token Authentication Key
BUNNY_API_KEY=…                  # Stream → library → API — enables in-app upload (task 22)
BUNNY_WEBHOOK_TOKEN=…            # random secret for the encoding webhook; openssl rand -hex 24
```

`BUNNY_SECURITY_KEY` is a signing secret. It never reaches the client, is never
included in a response, and is never bundled — the signature is computed
server-side and only the resulting hex digest travels. The same is true of
`BUNNY_API_KEY`: the browser receives a per-video TUS signature derived from
it, never the key itself. Both upload variables are optional — leave them
blank and the manual paste-a-GUID flow keeps working; playback signing is
unaffected either way.

## How the signature works

```
expires = unix_seconds(now) + 900                       # 15 minutes
token   = sha256_hex(BUNNY_SECURITY_KEY + videoId + expires)
url     = https://iframe.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{videoId}
          ?token={token}&expires={expires}
```

Implemented in `server/src/services/bunny.js`. The 15-minute TTL is a
deliberate compromise: long enough that a student who pauses to make tea does
not return to a dead frame, short enough that a URL pasted into a WhatsApp group
is worthless by the time anyone taps it. The player (task 11) re-requests on
expiry rather than failing.

## The endpoint

```
GET /api/enrollments/course/:slug/playback/:lessonId
```

Checks, in order — any failure returns 403 and no URL:

1. Authenticated (router-level `requireAuth`)
2. An enrolment exists for this user and course
3. The enrolment has not passed `expiresAt` (task 6's `isExpired`)
4. The lesson id actually belongs to this course

Then: non-video lesson types 400, a lesson with no `bunnyVideoId` 404, an
unconfigured server 503 — a misconfiguration must not read to the student as a
paywall problem.

Responses carry `Cache-Control: no-store`. Signed URLs are generated per request
and **never persisted** — not on the course document, not cached, and not
included in `GET /api/enrollments/course/:slug`, which returns the whole
curriculum tree and would otherwise leak a playable URL for every lesson at once.

For the same reason, `stripVideoRefs` removes `videoUrl` and `bunnyVideoId` from
both the player's curriculum tree and the **public** `GET /api/courses/:slug`,
replacing them with a boolean `hasVideo`.

## Uploading from the admin (task 22)

Admin → Courses → (a course) → Curriculum → the lesson → **Upload video**.
The lesson must have been saved once (upload is addressed by lesson id).

The pipeline, none of which passes the file through this server:

1. `POST /api/admin/courses/:id/lessons/:lessonId/video` creates the video
   object in Bunny, pins its GUID to the lesson (`videoStatus: uploading`),
   and returns a TUS presign — `sha256(libraryId + apiKey + expires + videoId)`
   plus the headers Bunny's TUS endpoint expects. Re-posting replaces: the
   previous video is deleted from Bunny best-effort after the new GUID commits.
2. The browser uploads to `https://video.bunnycdn.com/tusupload` with
   `tus-js-client` — resumable, with retry backoff and a progress bar.
3. When the upload lands, Bunny encodes. Status reaches the lesson two ways:
   - **Webhook (instant):** set the library's webhook URL to
     `https://<site>/api/webhooks/bunny?token=<BUNNY_WEBHOOK_TOKEN>`. Bunny
     signs nothing, so the token in the URL is the whole authentication —
     constant-time compared, endpoint disabled when unset. The handler treats
     the poke as a hint and re-reads the authoritative status from the API, so
     a forged poke cannot mark a broken video playable.
   - **Polling (fallback):** the editor polls
     `GET …/lessons/:lessonId/video`, which asks Bunny while the state is
     non-terminal and persists transitions. `ready` also stamps
     `videoDurationSeconds` and auto-fills the display duration if empty.
4. Playback refuses to sign anything not `ready` — `409 VIDEO_PROCESSING` /
   `409 VIDEO_FAILED` — so a student can never receive a signed URL for a
   broken frame. Lessons attached before task 22 (GUID, no status) read as
   `ready`, matching how they were created: pasted only after encoding
   finished. Failed encodes raise a Sentry event; the admin sees a red
   "Failed" chip with a re-upload button.

### Attaching by ID (manual fallback)

The old flow survives under **Advanced — attach by ID** on the lesson editor:
paste the video's GUID from the Bunny dashboard (Stream → library → the video →
the `guid` in its URL or API panel), not the embed URL. The legacy free-text
"Video URL" field is kept so old documents still load, but nothing serves it.

Task 13 will not publish a course whose lessons have no `bunnyVideoId` — a
catalogue where some courses cannot be watched after payment is worse than a
smaller catalogue.

## Verifying

1. As an enrolled student, open a lesson — it plays.
2. Copy the signed URL out of devtools, wait 15 minutes, open it → Bunny refuses.
3. As a user enrolled in a *different* course, call the endpoint → 403, no URL.
4. Set that enrolment's `expiresAt` to yesterday → 403, no URL.
5. Pass a lesson id from another course → 403, no URL.
6. `grep -r "BUNNY_SECURITY_KEY" client/dist` → empty.
