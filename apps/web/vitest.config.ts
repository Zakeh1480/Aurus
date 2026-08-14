import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3001',
    },
  },
});
