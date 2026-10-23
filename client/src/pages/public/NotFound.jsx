/**
 * The catch-all page, and what a feature-flagged subtree renders while its flag
 * is off. Plain markup on purpose: it is also the root error boundary's 404
 * view, which renders outside every provider.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5 text-center">
      <div>
        <h1 className="text-[2rem]">Page not found</h1>
        <p className="mt-2 text-muted">The page you’re after has moved or never existed.</p>
        <a href="/" className="mt-5 inline-block font-semibold text-brand hover:underline">
          ← Back home
        </a>
      </div>
    </div>
  )
}
