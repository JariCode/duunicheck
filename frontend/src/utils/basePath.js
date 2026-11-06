// Prefixes an app-relative path with the deployment base path (e.g. "/" or
// "/duunicheck/") so the app works both at the domain root and in a subfolder.
export function withBasePath(path) {
  const base = import.meta.env.BASE_URL
  return `${base}${String(path).replace(/^\//, '')}`
}
