import { defineConfig } from 'vite';
import editorBackend from './tools/editor-backend.js';

export default defineConfig({
  plugins: [editorBackend()],
  server: {
    port: 3000,
    // Don't fall back to index.html for JSON requests
    fs: {
      strict: false
    }
  },
  build: {
    target: 'esnext',
    // Copy data directory into build output
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
