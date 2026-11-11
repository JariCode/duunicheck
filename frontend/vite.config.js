import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Collapses the configured base path to a single leading and trailing slash,
// e.g. "duunicheck" or "/duunicheck" both become "/duunicheck/". An empty or
// unset value falls back to the domain root "/".
function normalizeBasePath(raw) {
  const segments = String(raw || '').split('/').filter(Boolean)
  return segments.length ? `/${segments.join('/')}/` : '/'
}

// Reads the `Header always set Name "value"` lines from public/.htaccess, so `vite preview`
// sends the same security headers as production and they are maintained in one place.
function readHtaccessHeaders() {
  const htaccess = readFileSync(new URL('./public/.htaccess', import.meta.url), 'utf8')
  const headers = {}
  for (const match of htaccess.matchAll(/^\s*Header\s+always\s+set\s+([\w-]+)\s+"((?:[^"\\]|\\.)*)"\s*$/gm)) {
    headers[match[1]] = match[2].replace(/\\(.)/g, '$1')
  }
  return headers
}

// A local build may call a local backend (e.g. http://localhost:5000) that the production CSP
// does not allow. Only in preview, that one API origin is added to connect-src.
function allowPreviewApiOrigin(headers, apiUrl) {
  let origin
  try { origin = new URL(apiUrl).origin } catch { return headers }
  for (const name of ['Content-Security-Policy', 'Content-Security-Policy-Report-Only']) {
    const policy = headers[name]
    if (!policy || policy.includes(origin)) continue
    headers[name] = policy.replace(/(^|;\s*)connect-src([^;]*)/, `$1connect-src$2 ${origin}`)
  }
  return headers
}

// Preview only: the dev server keeps working without these headers, because Vite's HMR
// client is not compatible with the strict CSP.
const previewSecurityHeaders = {
  name: 'preview-security-headers',
  configurePreviewServer(server) {
    const headers = allowPreviewApiOrigin(readHtaccessHeaders(), server.config.env.VITE_API_URL)
    // Apache's DirectorySlash redirects /duunicheck to /duunicheck/ in production; Vite's
    // preview does not, so the same 301 is done here (query string kept).
    const baseWithoutSlash = server.config.base.replace(/\/$/, '')
    server.middlewares.use((request, response, next) => {
      for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
      const [path, query] = (request.url || '').split(/\?(.*)/s)
      if (baseWithoutSlash && path === baseWithoutSlash) {
        response.statusCode = 301
        response.setHeader('Location', `${baseWithoutSlash}/${query !== undefined ? `?${query}` : ''}`)
        response.end()
        return
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite always runs this config with the project root as the working
  // directory, so "." resolves to the same place as process.cwd() here
  // without needing a Node global that the browser-targeted eslint config disallows.
  const env = loadEnv(mode, '.', '')
  return {
    base: normalizeBasePath(env.VITE_BASE_PATH),
    plugins: [react(), previewSecurityHeaders],
  }
})
