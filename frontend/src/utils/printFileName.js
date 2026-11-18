// File names for printed documents. Used by the PDF made on the device (printPdf.js) and as the page
// title during window.print(), which Chrome, Edge and Firefox offer as the name of the saved PDF.
function safeFileName(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%{}^~[\]`'$&@+=,;!]/g, ' ')
    // eslint-disable-next-line no-control-regex -- control characters are not allowed in file names
    .replace(/[\u0000-\u001f\u007f·•–—]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80)
    .replace(/[._]+$/g, '')
}

export function pdfFileName(document) {
  const kind = document?.kind || 'notes'
  const named = (prefix, value) => {
    const name = safeFileName(value)
    return `${name ? `${prefix}_${name}` : prefix}.pdf`
  }
  if (kind === 'cv') return named('CV', document.cv?.fullName || document.title)
  if (kind === 'application') return named('Hakemus', document.job?.company || document.cv?.fullName)
  if (kind === 'letter') return named('Kirje', document.title)
  if (kind === 'applicationSummary')
    return named('Hakemus', [document.job?.company, document.job?.role].filter(Boolean).join(' '))
  return named('Muistiinpanot', String(document?.title || '').replace(/^Muistiinpanot\s*·?\s*/, ''))
}

// The same name without .pdf, for the page title while the print dialog is open.
export function printPageTitle(document) {
  return pdfFileName(document).replace(/\.pdf$/, '')
}
