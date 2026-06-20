import { defineConfig } from 'vite';
import { resolve } from 'path';

// If running in purely web dev mode without the Electron backend, 
// we still load the legacy editor backend plugin.
import editorBackend from './tools/editor-backend.js';

const isElectronDev = process.env.VITE_ELECTRON === 'true';

export default defineConfig({
  plugins: isElectronDev ? [] : [editorBackend()],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    strictPort: true,
    fs: {
      strict: false
    },
    // Proxy API/data requests to the Electron embedded server when in electron dev mode
    proxy: isElectronDev ? {
      '/api': 'http://127.0.0.1:3001',
      '/data': 'http://127.0.0.1:3001',
      '/assets': 'http://127.0.0.1:3001'
    } : {}
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tools: resolve(__dirname, 'tools/index.html'),
        launcher: resolve(__dirname, 'launcher/index.html')
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
