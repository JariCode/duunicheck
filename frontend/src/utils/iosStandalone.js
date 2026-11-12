// iPadOS reports itself as a Mac, so a touch-capable "Mac" is treated as an iPad.
function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// True when DuuniCheck runs as an app added to the iOS home screen. window.print() does nothing there.
// A web app added to the Mac Dock also reports navigator.standalone, but it can print, so only iOS counts.
export function isIosStandalone() {
  if (typeof window === 'undefined') return false
  if (!isIosDevice()) return false
  return window.navigator.standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
}