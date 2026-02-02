import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
    },

    pool: 'forks',
    environment: 'happy-dom',

    restoreMocks: true,
    mockReset: true,
    clearMocks: true,

    globals: true,

    include: ['src/**/*.tests.ts'],
    exclude: ['node_modules', 'dist', '**/test.tests.ts'],

    // Debugging
    logHeapUsage: false, // Set to true to debug memory issues

    // Coverage (when running with --coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
})
