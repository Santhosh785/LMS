import { useEffect } from 'react'

/**
 * Flat reveal-on-scroll, as the redesign's per-page scripts implement it.
 *
 * Each vendored stylesheet starts its animated elements at opacity 0 and only
 * paints them once a class is added, so without this the page renders blank
 * below the fold. The drop uses slightly different names per page (`.about-reveal`
 * / `.is-in` / `--ab-i` on About, and so on), which is why they are parameters
 * rather than constants.
 *
 * For the homepage's nested variant — observe the section, then stagger the
 * cards inside it — use useScrollReveal instead.
 *
 * `prefers-reduced-motion` short-circuits to marking everything visible.
 */
export default function useRevealOnScroll(
  rootRef,
  {
    selectors,
    revealClass,
    visibleClass = 'is-in',
    indexVar,
    stagger = 8,
    rootMargin = '0px 0px -8% 0px',
    threshold = 0.12,
    deps = [],
  },
) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || !selectors.length) return undefined

    const els = [...root.querySelectorAll(selectors.join(','))]
    if (!els.length) return undefined

    const mark = (el) => el.classList.add(visibleClass)
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    els.forEach((el, i) => {
      // Optional: some sheets put the hidden state on the element's own class
      // (.ws-card), so there is nothing extra to add — only `visibleClass`.
      if (revealClass) el.classList.add(revealClass)
      if (indexVar) el.style.setProperty(indexVar, String(i % stagger))
    })

    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(mark)
      return undefined
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          mark(entry.target)
          io.unobserve(entry.target)
        })
      },
      { rootMargin, threshold },
    )
    els.filter((el) => !el.classList.contains(visibleClass)).forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are the caller's re-run triggers
  }, [rootRef, ...deps])
}
