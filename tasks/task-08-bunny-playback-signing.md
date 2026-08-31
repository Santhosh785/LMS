---
task: 8
name: bunny-playback-signing
parallel_group: 3
depends_on: [6]
type: backend
---

# Task 8: Bunny Stream playback signing

## What to build

The course videos already exist in Bunny Stream, but nothing in the application knows how to serve them. `lessonSchema` in `server/src/models/Course.js` has a `videoUrl` string that no route reads, and a `drmEnabled` boolean on the course that nothing implements.

This task makes the paywall real **at the CDN**. Gating the page is meaningless if the video URL itself is public — anyone could share the link and bypass payment entirely.

**Schema.** Add a `bunnyVideoId` field to `lessonSchema`. Keep the existing `videoUrl` field for backward compatibility rather than migrating it away.

**Signing.** A utility that produces a Bunny token-authenticated URL: a SHA256 hash over the security key, the path and an expiry timestamp, per Bunny's token authentication scheme. Use a short time-to-live — around 15 minutes. Token Authentication must be enabled on the Bunny library for this to be enforced; document that as a manual dashboard step.

Credentials come from `BUNNY_LIBRARY_ID` and `BUNNY_SECURITY_KEY`, added to config by task 1. The security key must never reach the client.

**The endpoint.** A route that takes a course and lesson, and returns a freshly signed playback URL. It must verify, in order:

1. The user is authenticated
2. An enrollment exists for that user and course
3. The enrollment has not expired — reuse the `expiresAt` logic from task 6 rather than reimplementing it
4. The lesson actually belongs to the course

Any failure returns 403 and no URL.

**Signed URLs are generated per request and never persisted.** Do not store them on the course document, do not cache them, and do not include them in the payload returned by `GET /api/enrollments/course/:slug` — that response is the whole curriculum tree and would leak playable URLs for every lesson at once.

Real DRM (Widevine/FairPlay) is explicitly out of scope. Signed expiring URLs plus the watermark option are the right level for this price point.

## Acceptance criteria

- [ ] `lessonSchema` has `bunnyVideoId`; existing documents with only `videoUrl` still load
- [ ] The signing utility produces a URL Bunny accepts with Token Authentication enabled
- [ ] A request for a lesson in a course the user is not enrolled in returns 403 with no URL
- [ ] A request against an expired enrollment returns 403 with no URL
- [ ] A request for a lesson id that does not belong to the given course returns 403
- [ ] An enrolled user receives a URL that plays
- [ ] Replaying a captured URL after its TTL fails
- [ ] `BUNNY_SECURITY_KEY` never appears in any client response or bundle
- [ ] `GET /api/enrollments/course/:slug` contains no signed URLs
