import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SiteConfigProvider } from './context/SiteConfigContext.jsx'
import { installGlobalHandlers } from './lib/observability.js'
import './index.css'
// Redesign stylesheets, vendored verbatim from the client's static drop. They
// load after index.css so their page-scoped rules win over Tailwind utilities
// of equal specificity. See styles/redesign/README.md.
// Order mirrors the drop's own cascade: base.css @imports site-enhance.css
// first, then styles.css, then the per-page sheet. shared.css carries the
// slices of base.css/styles.css that are not chrome.
import './styles/redesign/site-enhance.css'
import './styles/redesign/shared.css'
import './styles/redesign/home-lemlist.css'
import './styles/redesign/about.css'
import './styles/redesign/program.css'
import './styles/redesign/program-apply.css'
import './styles/redesign/explore.css'
import './styles/redesign/category.css'
import './styles/redesign/course.css'
import './styles/redesign/workshops.css'
import './styles/redesign/workshop-landing.css'
import './styles/redesign/blog.css'
import './styles/redesign/resources.css'
import './styles/redesign/overrides.css'

// Unhandled promise rejections and window errors — the class of failure behind
// "checkout didn't work and nothing happened".
installGlobalHandlers()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: 1 },
  },
})

/**
 * The outer boundary is the last resort: it catches a failure in the providers
 * themselves, where there is no router left to navigate with. App.jsx carries a
 * second one around the route outlet so an ordinary broken page keeps the header
 * and navigation intact.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary scope="root">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SiteConfigProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SiteConfigProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
