import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'
import { installGlobalHandlers } from './lib/observability.js'

// Unhandled promise rejections and window errors — the class of failure behind
// "checkout didn't work and nothing happened". Installed before hydration so a
// failure during hydration itself is reported too.
installGlobalHandlers()

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  )
})
