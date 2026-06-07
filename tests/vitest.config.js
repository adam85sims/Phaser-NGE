import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Map source alias so imports resolve relative to src/
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    // Keep test output focused
    reporters: process.env.CI ? 'default' : 'verbose',
  }
});
