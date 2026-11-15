/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'
import { appInfo } from './scripts/build-info.mjs'
const info = appInfo(pkg.version)

// Base path: served at / in dev, /open-date/ on GitHub Pages.
export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'app-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info) + '\n' }) },
  }],
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
