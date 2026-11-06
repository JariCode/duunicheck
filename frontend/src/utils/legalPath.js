const legalPages = new Set(['kayttoehdot', 'tietosuojaseloste'])

function basePath() {
  const base = import.meta.env.BASE_URL || '/'
  return `/${base.split('/').filter(Boolean).join('/')}`.replace(/^\/$/, '')
}

export function legalPageFromPath(pathname) {
  const path = `/${String(pathname || '').split('?')[0].split('#')[0].split('/').filter(Boolean).join('/')}`
  const base = basePath()
  const relative = base && path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path.slice(1)
  return legalPages.has(relative) ? relative : null
}

export function legalHref(page) {
  if (!legalPages.has(page)) return `${basePath() || ''}/`
  return `${basePath() || ''}/${page}`
}

export function legalPageFromHref(href) {
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null
    return legalPageFromPath(url.pathname)
  } catch {
    return null
  }
}
