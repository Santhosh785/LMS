# Vendored redesign stylesheets

Files in this directory are copied **verbatim** from the client's 2026 redesign
drop (`Growth Scholar/css/*.css`). They are not hand-written and should not be
hand-edited.

## Why these are not Tailwind

The rest of the client ports the original static CSS into `tailwind.config.js`
value-for-value, because that port was done once, from a design that was already
the product. The redesign is different: it arrives as a large, finished,
self-consistent stylesheet that the client will revise again. Re-translating
~1,800 lines per drop into utility classes would be slow and would introduce
drift the moment a value was mistyped. Importing the drop unchanged means the
rendered page is the delivered design by construction, and re-syncing the next
drop is a `cp`.

## How they are wired

- **Tokens.** Every file references `var(--brand)`, `var(--line)` and friends.
  Those custom properties are declared in `src/index.css`, transcribed from the
  drop's `css/base.css`. `tailwind.config.js` holds the same literals for the
  Tailwind-based components. Change one, change both in the same commit.
- **Load order.** Imported from `src/main.jsx` *after* `./index.css`, so a rule
  here beats a Tailwind utility of equal specificity.
- **Scoping.** Each sheet is scoped under the page class the static build set on
  `<body>` (`.home-lm`, …). React applies it with `hooks/useBodyClass.js`.

## Adding a sheet from a new drop

1. `cp "<drop>/css/<name>.css" client/src/styles/redesign/<name>.css`
2. Prepend the provenance header used by the existing files.
3. Confirm every `var(--…)` it uses is declared in `src/index.css`.
4. Confirm it contains no global or chrome rules (`body`, `.site-header`,
   `.nav`, `.site-footer`) that would collide with the shared components — the
   header and footer are React components, not vendored CSS.
5. Import it in `src/main.jsx`.

## What must not go here

Global resets, header/footer chrome, and anything that needs to differ from the
drop. Overrides belong in a separate, later-loaded stylesheet so that this
directory stays a faithful mirror of what the client delivered.
