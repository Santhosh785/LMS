import type { Config } from '@react-router/dev/config'

/**
 * Framework-mode configuration. The app is server-rendered by the Express
 * process (server/src/middleware/reactRouter.js), so `ssr` stays on. The v8
 * middleware flag is deliberately left off: the load context is then the plain
 * object `getLoadContext` returns (see src/types/load-context.d.ts).
 */
export default {
  ssr: true,
  appDirectory: 'src',
} satisfies Config
