---
task: 11
name: course-player-ui
parallel_group: 4
depends_on: [8]
type: ui
---

# Task 11: Course player video UI

## What to build

The course player has no video. `client/src/pages/student/CoursePlayer.jsx` renders a styled `div` with a play button whose click handler is literally:

```js
onClick={() => toast.show('Video playback is not wired up in this build')}
```

This is the core deliverable of the paid product. Task 8 built the signing endpoint; this task consumes it.

**The player.** Replace the placeholder block (around lines 76–86) with a Bunny Stream iframe fed by a signed URL fetched from the task 8 endpoint for the currently selected lesson. Requirements:

- Fetch a fresh signed URL when the selected lesson changes — do not fetch every lesson's URL up front
- Signed URLs expire in roughly 15 minutes. A student pausing for a while and resuming must not hit a dead player: handle expiry by re-requesting rather than failing
- Keep the existing responsive `aspect-video` container so the layout does not shift
- Show a real loading state while the URL resolves, and a clear message on 403 distinguishing "not enrolled" from "your access has expired", matching the distinct errors task 6 returns

**Non-video lessons.** `lessonSchema` supports content types including Audio, E-book, PDF, Text, Downloads, Quiz, Survey, Assignment and Live. Only Video is in scope here. For other types, render an honest placeholder naming the type — do not show a broken video frame, and do not repeat the original sin of a play button that lies.

**Progress.** The existing progress tracking through `PATCH /api/enrollments/:id/progress` continues to work as it does today. Wiring progress to actual playback position is out of scope.

**Admin input.** `client/src/pages/admin/courseTabs.jsx` has a "Video URL" text field in the curriculum editor (around line 212). Add a `Bunny Video ID` field beside it, bound to the `bunnyVideoId` added by task 8. This is how content actually gets attached to lessons, so it must work — task 13 depends on it to publish real courses.

Note `courseTabs.jsx` is a 540-line file exporting seven components. Do not refactor it; that is deliberately deferred. Make the minimal addition.

## Acceptance criteria

- [ ] An enrolled student can play a lesson video end to end
- [ ] Switching lessons loads the new video and does not replay the previous one
- [ ] A signed URL expiring mid-session recovers without a page reload
- [ ] A non-enrolled user sees an access message, never a player
- [ ] An expired enrollment shows an expiry message distinct from the not-enrolled message
- [ ] Non-video lesson types show an honest placeholder naming the type
- [ ] No handler anywhere still says "not wired up in this build"
- [ ] The admin curriculum editor saves a `bunnyVideoId` that the player then uses
- [ ] The player is usable on a 360px phone screen
- [ ] No signed URL is written to localStorage or any persistent client storage
