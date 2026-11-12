import { isIosStandalone } from './iosStandalone'

// Safari or a web app added to the Mac Dock: WebKit on a Mac without touch. Chromium browsers
// (Chrome, Edge, Opera, Brave) and Firefox on a Mac are excluded, and so is an iPad, which reports
// itself as a Mac but has touch.
export function isMacSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (!/Macintosh/.test(ua) || !/AppleWebKit\//.test(ua)) return false
  if (navigator.maxTouchPoints > 1) return false
  // Only Chromium browsers have navigator.userAgentData; the UA test covers browsers that hide it.
  if (navigator.userAgentData || /Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua)) return false
  return true
}

// How a document is printed:
// - 'share': the iOS home screen app, where window.print() does nothing. A PDF is made and handed to the
//   iOS share sheet.
// - 'open': Safari and the Dock app on a Mac, where window.print() places the document too high on the
//   paper. A PDF is made and opened in Safari's PDF view, which prints it exactly (Cmd+P).
// - 'print': everywhere else, window.print() with the print styles of PrintSheet.css.
export function printTarget() {
  if (isIosStandalone()) return 'share'
  if (isMacSafari()) return 'open'
  return 'print'
}
