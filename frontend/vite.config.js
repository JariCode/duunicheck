import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Collapses the configured base path to a single leading and trailing slash,
// e.g. "duunicheck" or "/duunicheck" both become "/duunicheck/". An empty or
// unset value falls back to the domain root "/".
function normalizeBasePath(raw) {
  const segments = String(raw || '').split('/').filter(Boolean)
  return segments.length ? `/${segments.join('/')}/` : '/'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite always runs this config with the project root as the working
  // directory, so "." resolves to the same place as process.cwd() here
  // without needing a Node global that the browser-targeted eslint config disallows.
  const env = loadEnv(mode, '.', '')
  return {
    base: normalizeBasePath(env.VITE_BASE_PATH),
    plugins: [react()],
  }
})
