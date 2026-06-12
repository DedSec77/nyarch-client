import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Tauri expects a fixed dev server. When running under Tauri the
// TAURI_ENV_* vars are present; we keep web defaults otherwise.
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
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
