import { useEffect } from 'react'

/**
 * Mirrors the `<body class="...">` the static build set per page.
 *
 * The 2026 redesign's stylesheets are scoped under a page class (`.home-lm`,
 * `.about-page`, …) so that one page's rules cannot leak into another. React
 * renders pages inside a shared layout, so the class has to be applied to
 * <body> imperatively and removed on unmount.
 *
 * Multiple simultaneous callers are safe: each adds and removes only its own
 * class, so a nested route that sets a second one does not clobber the first.
 */
export default function useBodyClass(className) {
  useEffect(() => {
    if (!className) return undefined
    const names = className.split(' ').filter(Boolean)
    if (!names.length) return undefined

    document.body.classList.add(...names)
    return () => document.body.classList.remove(...names)
  }, [className])
}
