import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20_000,
    setupFiles: process.env.SKIP_DB_TESTS ? [] : ['./tests/setup-db.ts'],
  },
});
