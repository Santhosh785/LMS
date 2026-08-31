import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    /**
     * Sequential, single-fork. The tests share one MongoDB database and several
     * assert on exact document counts; parallel files would see each other's
     * rows and fail in ways that look like real bugs.
     */
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
})
