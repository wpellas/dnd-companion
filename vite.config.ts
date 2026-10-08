import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { hubPlugin } from './server/hubPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  // `host: true` listens on the local network too, so phones / tablets / a TV can open the player view.
  server: { host: true },
  preview: { host: true },
  plugins: [react(), hubPlugin()],
})
