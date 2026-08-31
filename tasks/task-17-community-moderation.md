---
task: 17
name: community-moderation
parallel_group: 6
depends_on: [14]
type: backend
---

# Task 17: Community moderation

## What to build

The community module lets any authenticated user create posts and comments, and provides no way to remove them. `server/src/routes/community.routes.js` has no delete handler of any kind — not for admins, not even for a user's own content. The admin community routes only manage channels. There is no report, no block, and no profanity handling.

Public user-generated content with no removal mechanism is a genuine liability: the first abusive or defamatory post cannot be taken down without a direct database edit.

**Author deletion.** A user can delete their own post or comment. Deleting a post must also remove its comments — leaving orphans is the same bug task 18 fixes elsewhere. Decrement `commentCount` atomically with `$inc`, consistent with the pattern task 6 established.

**Admin deletion.** An admin can delete any post or comment. The existing `requireRole('admin')` middleware from `server/src/middleware/auth.js` is the right gate.

**Reporting.** A lightweight `Report` model recording the reported post or comment, the reporter, a reason, and a resolution status. Add a report control to the community UI in `client/src/components/community/index.jsx`, and a queue in the admin console where reports can be reviewed and actioned. Reporting must be rate-limited — it is trivially abusable as a harassment tool.

**Blocking.** A user can block another user, hiding that user's posts and comments from their own feed. Keep this simple: mutual invisibility, no notification to the blocked party.

**Authorization is the part to get right.** Every delete must verify ownership or admin role server-side. Hiding a delete button in the UI is not access control. Verify directly that user A cannot delete user B's post by calling the endpoint.

Do not build automated profanity filtering — it is out of scope, and a human moderation queue is more appropriate at this scale.

## Acceptance criteria

- [ ] A user can delete their own post and their own comment
- [ ] Deleting a post removes its comments; no orphans remain
- [ ] `commentCount` is maintained with atomic `$inc`
- [ ] An admin can delete any post or comment
- [ ] User A calling delete on user B's post receives 403 and the post survives
- [ ] Posts and comments can be reported, and reports appear in an admin queue
- [ ] Reporting is rate-limited
- [ ] A blocked user's posts and comments disappear from the blocker's feed
- [ ] Every authorization check is enforced server-side, verified by direct API calls
