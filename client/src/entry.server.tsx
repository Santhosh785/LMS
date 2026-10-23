import { PassThrough } from 'node:stream'
import type { AppLoadContext, EntryContext, HandleErrorFunction } from 'react-router'
import { ServerRouter } from 'react-router'
import { createReadableStreamFromReadable } from '@react-router/node'
import { renderToPipeableStream } from 'react-dom/server'
import { isbot } from 'isbot'
import { captureServerError } from 'growth-scholar-server/src/config/observability.js'

/** How long a render may stream before it is abandoned. */
const ABORT_DELAY_MS = 5_000

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false
    const userAgent = request.headers.get('user-agent')
    // A crawler gets the finished document; a browser gets the shell as soon
    // as it is ready and the rest streamed in.
    const readyOption: 'onAllReady' | 'onShellReady' =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? 'onAllReady' : 'onShellReady'
    // Mirrors root.tsx: the development CSP has no nonce, so the tree carries
    // none either (see the note in Layout).
    const nonce = import.meta.env.PROD ? loadContext?.nonce : undefined

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
      {
        nonce,
        [readyOption]() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)
          responseHeaders.set('Content-Type', 'text/html')
          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }))
          pipe(body)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          // Errors before the shell is ready surface through onShellError and
          // handleError; after it the stream is already going, so log here.
          if (shellRendered) console.error(error)
        },
      },
    )

    setTimeout(abort, ABORT_DELAY_MS)
  })
}

/**
 * Loader and render errors, routed to the same Sentry client the Express
 * process initialised (the import is kept external to the build so this is
 * that module instance, not a copy). A request the client abandoned is not an
 * error.
 */
export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return
  console.error(error)
  const url = new URL(request.url)
  captureServerError(error, { method: request.method, originalUrl: url.pathname + url.search }, 500)
}
