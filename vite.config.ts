import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

// App version is injected at build time so the desktop update-check can
// compare the running build against the latest GitHub release.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'))

// Tauri expects a fixed dev server. When running under Tauri the
// TAURI_ENV_* vars are present; we keep web defaults otherwise.
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // prevent vite from obscuring rust errors
  clearScreen: false,
  server: {
    host: host || false,
    port: 5173,
    strictPort: true,
    hmr: host
      ? { protocol: 'ws', host, port: 5183 }
      : undefined,
  },
})
