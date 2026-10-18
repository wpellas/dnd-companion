import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** Where the Laravel backend answers during `pnpm dev`: `API_URL` if set, else the backend's own `APP_URL` (the Herd site), so the two never drift apart. */
const api = { target: process.env.API_URL ?? loadEnv('development', 'backend', '').APP_URL ?? 'http://127.0.0.1:8000', changeOrigin: true }

// https://vite.dev/config/
export default defineConfig({
  // `host: true` listens on the local network too, so a phone can open the dev server.
  // `/api` goes to the backend, so the browser sees one origin and the session cookie just works.
  server: { host: true, proxy: { '/api': api } },
  preview: { host: true, proxy: { '/api': api } },
  // The build lands in Laravel's web root: the web server (Herd, Inleed) then serves the app and the API from one place.
  build: { outDir: 'backend/public', emptyOutDir: false },
  plugins: [react()],
})
