import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so unit tests don't boot the Workers runtime
export default defineConfig({
  test: { environment: 'node', include: ['worker/**/*.test.ts', 'src/**/*.test.ts'] },
});
