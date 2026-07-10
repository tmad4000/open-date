/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// Base path: served at / in dev, /open-date/ on GitHub Pages.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/open-date/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 7643,
    strictPort: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
