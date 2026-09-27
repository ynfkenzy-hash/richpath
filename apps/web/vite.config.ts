import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // bind 0.0.0.0 so the sandbox preview can reach it
    port: 5173,
    strictPort: true,
    // Dev-preview hosts (e.g. *.e2b.app) must be allowed to hit the dev server.
    allowedHosts: true,
    proxy: {
      // The browser talks only to this origin; Vite forwards /api to the API.
      // This keeps cookies first-party and avoids CORS in development.
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: { host: true, port: 4173, allowedHosts: true },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split vendor code so app changes don't invalidate the whole bundle.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', 'axios', 'react-hook-form'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
});
