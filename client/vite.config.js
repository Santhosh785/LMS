import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'

/**
 * The React Router plugin replaces @vitejs/plugin-react — the two must not
 * coexist. No dev proxy: Express embeds Vite in middleware mode, so the API is
 * same-origin in development too. No manual chunks: the framework splits the
 * bundle per route.
 */
export default defineConfig({
  plugins: [reactRouter()],
  ssr: {
    /*
     * entry.server reports render errors through the server's own
     * observability module. The import is a bare specifier into the server
     * workspace, kept external so the server build shares the one module
     * instance Express initialised (a bundled copy would never see the Sentry
     * client and would report nothing).
     */
    external: ['growth-scholar-server'],
  },
})
