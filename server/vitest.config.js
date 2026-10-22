import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    /**
     * Sequential, one worker. The tests share one Postgres database (the
     * Supabase test project) and several assert on exact row counts; parallel
     * files would see each other's rows and fail in ways that look like real
     * bugs. Separate `vitest` processes are serialised by the advisory lock in
     * tests/setup.js. (Vitest 4 dropped `poolOptions.forks.singleFork`, which
     * this used to rely on — `maxWorkers` is its replacement.)
     */
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    // Remote database: every query is a network round trip.
    testTimeout: 30_000,
    hookTimeout: 20_000,
  },
})
