---
task: 21
name: eslint-prettier-tooling
parallel_group: 7
depends_on: [14]
type: mechanical
---

# Task 21: Linting and formatting

## What to build

Neither `client/` nor `server/` has ESLint, Prettier, TypeScript, or any editor configuration. There is no automated check of any kind on either side. With most changes now being AI-assisted, style and correctness drift accumulate quickly and invisibly.

**ESLint** for both packages. The server is ES modules (`"type": "module"`) on Node; the client is React 18 with JSX. Configure each appropriately, including the React hooks rules — the codebase uses hooks heavily and the exhaustive-deps rule catches real stale-closure bugs.

Prioritise rules that catch bugs over rules that enforce taste: unused variables, undefined references, unhandled promises, missing hook dependencies, accidental globals.

**Prettier** with a single shared configuration. Match the existing style rather than reformatting everything to a new one — the codebase is consistent (no semicolons, single quotes, 2-space indentation).

**Fix what the linter finds.** Expect real bugs among the noise, particularly missing hook dependencies and unused imports in the larger admin files. Where a rule fires on intentional code, add a targeted inline disable with a reason — never a blanket disable for a whole file or rule.

**Format as a separate commit.** A formatting pass touches nearly every file and, mixed with logic changes, makes review impossible and `git blame` useless. Run it as its own commit with no behavioural change.

**Scripts** in both `package.json` files for lint and format, plus a combined check runnable from the repo root — the root already orchestrates both packages with `concurrently`.

**Explicitly out of scope:** TypeScript migration, splitting the five admin files over 330 lines, and code splitting the ~483KB bundle. All were deliberately deferred. This task is the cheap tooling that makes those refactors safer later.

A pre-commit hook is optional and worth adding only if it does not slow the commit loop enough to be bypassed.

## Acceptance criteria

- [ ] ESLint runs clean on both `client/` and `server/` with a single command
- [ ] React hooks rules including exhaustive-deps are enabled and passing
- [ ] Prettier configuration matches the existing code style
- [ ] The formatting pass is an isolated commit with no behavioural change
- [ ] Real bugs surfaced by the linter were fixed, not suppressed
- [ ] Every inline disable carries a reason; no file-wide or rule-wide disables
- [ ] Lint and format scripts exist in both packages and can be run from the root
- [ ] The application builds and runs identically after the formatting pass
