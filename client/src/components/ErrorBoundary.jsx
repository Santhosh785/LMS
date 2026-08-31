import { Component } from 'react'
import { reportClientError } from '../lib/observability.js'

/**
 * Catches render errors so one broken component does not white-screen the site.
 *
 * There was no boundary anywhere: any error thrown during render unmounted the
 * whole tree, leaving a blank page with no message and no way back, and the
 * stack trace went to a console nobody is watching.
 *
 * Still a class component — `componentDidCatch` has no hook equivalent, and
 * that is the only way React exposes this.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    reportClientError(error, { componentStack: info?.componentStack, scope: this.props.scope })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, () => this.setState({ error: null }))

    return (
      <div className="grid min-h-[50vh] place-items-center px-5 py-16 text-center">
        <div className="max-w-md">
          <span className="text-3xl" aria-hidden="true">
            ⚠️
          </span>
          <h1 className="mt-3 text-[1.4rem]">Something went wrong on this page</h1>
          <p className="mt-2 text-[0.92rem] leading-relaxed text-muted">
            It has been reported and we will look at it. Nothing you have paid for is affected.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {/*
              Clearing the error re-renders the same subtree, which is the right
              first try for a transient failure. The reload is the escape hatch
              when it is not transient — a message with no way back is only
              marginally better than a white screen.
            */}
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="inline-flex min-h-[42px] items-center rounded-full bg-brand px-5 text-[0.92rem] font-semibold text-white hover:bg-brand-deep"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex min-h-[42px] items-center rounded-full border border-line px-5 text-[0.92rem] font-semibold text-brand hover:bg-accent-soft"
            >
              Back home
            </a>
          </div>
          {/* The stack is for a developer, not a learner — hidden by default and
              never shown in a production build. */}
          {import.meta.env.DEV && (
            <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-md2 bg-surface-mist p-3 text-left text-[0.72rem] text-muted">
              {error.stack || String(error)}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
