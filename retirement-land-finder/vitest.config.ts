import { defineConfig } from 'vitest/config';

// One test runner for both workspaces. All current tests are pure logic
// (no DOM), so the default node environment is enough. Vite resolves the
// `./x.js` import specifiers the source uses to their `.ts` siblings.
export default defineConfig({
  test: {
    include: ['client/src/**/*.test.ts', 'server/src/**/*.test.ts'],
    environment: 'node',
  },
});
