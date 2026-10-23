import { collectBrowserErrors, HYDRATION_ERROR, settle } from '../fixtures/browser'
import { test, expect } from '../fixtures/content'

/**
 * A server-rendered page whose markup differs from what the client renders is
 * thrown away and rebuilt by React: the visitor sees a flash, and the SSR work
 * (and its SEO value) is wasted. React reports it as a console error, so the
 * pages that matter most are loaded in a real browser and the console is read.
 */

test.describe('the detector', () => {
  // The suite runs against a minified production build, where React prints a
  // numbered error with a link instead of the sentence. Keep both recognised.
  const messages = [
    'Warning: Text content did not match. Server: "a" Client: "b"',
    'Hydration failed because the initial UI does not match what was rendered on the server.',
    'Error: There was an error while hydrating. Because the error happened outside of a Suspense boundary…',
    'Warning: Expected server HTML to contain a matching <div> in <div>.',
    'Uncaught Error: Minified React error #418; visit https://react.dev/errors/418 for the full message',
    'Uncaught Error: Minified React error #425; visit https://react.dev/errors/425?args[]=text',
  ]
  for (const message of messages) {
    test(`flags: ${message.slice(0, 60)}`, () => {
      expect(message).toMatch(HYDRATION_ERROR)
    })
  }

  test('ignores an ordinary failed request', () => {
    expect('Failed to load resource: the server responded with a status of 401 ()').not.toMatch(
      HYDRATION_ERROR,
    )
  })
})

test.describe('no hydration errors in the browser console', () => {
  const pages: [string, (d: { course: { slug: string }; blogSlug: string }) => string][] = [
    ['home', () => '/'],
    ['course page', (d) => `/courses/${d.course.slug}`],
    ['blog post', (d) => `/blog/${d.blogSlug}`],
  ]

  for (const [name, path] of pages) {
    test(name, async ({ page, discovered }) => {
      const errors = collectBrowserErrors(page)
      await page.goto(path(discovered))
      await settle(page)

      // De-duplicated and clipped: one mismatch is reported many times over.
      const hydration = [
        ...new Set(errors.filter((e) => HYDRATION_ERROR.test(e)).map((e) => e.slice(0, 200))),
      ]
      expect(hydration, `hydration errors on ${path(discovered)}`).toEqual([])
    })
  }
})
