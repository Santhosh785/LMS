import { useEffect } from 'react'

/**
 * The reveal-on-scroll pass from the redesign's js/home-lemlist.js.
 *
 * Sections fade up as they enter the viewport, and the cards inside them
 * stagger via the `--lm-i` index the stylesheet reads. Reproduced here rather
 * than dropped because the vendored CSS starts these elements at opacity 0 —
 * without something adding `.is-visible`, the page renders blank below the hero.
 *
 * `prefers-reduced-motion` short-circuits to marking everything visible, as the
 * original did. Pass `deps` so the pass re-runs when async content (course and
 * workshop cards) arrives after the first paint; elements already marked are
 * skipped, so re-running is cheap and never re-animates.
 *
 * @param {import('react').RefObject<HTMLElement>} rootRef container to scan
 * @param {Array} deps re-run triggers
 */

const ITEM_SELECTOR =
  '.lm-lang-card, .lm-flagship-card, .lm-course, .lm-resource-card, .lm-journey-step, .lm-review'

export default function useScrollReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const mark = (el) => el.classList.add('is-visible')
    const sections = [...root.querySelectorAll(':scope > section:not(.lm-hero), .lm-product')]
    const items = [...root.querySelectorAll(ITEM_SELECTOR)]

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced || !('IntersectionObserver' in window)) {
      sections.forEach(mark)
      items.forEach(mark)
      return undefined
    }

    sections.forEach((el) => el.classList.add('lm-reveal'))
    items.forEach((el, i) => {
      el.classList.add('lm-reveal-item')
      el.style.setProperty('--lm-i', String(i % 6))
    })

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          mark(entry.target)
          entry.target.querySelectorAll('.lm-reveal-item').forEach((child, i) => {
            child.style.setProperty('--lm-i', String(i))
            mark(child)
          })
          io.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    )

    sections.filter((el) => !el.classList.contains('is-visible')).forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's re-run triggers
  }, [rootRef, ...deps])
}
