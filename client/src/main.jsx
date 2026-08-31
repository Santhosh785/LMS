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
