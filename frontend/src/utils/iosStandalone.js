// iPadOS reports itself as a Mac, so a touch-capable "Mac" is treated as an iPad.
function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// True when DuuniCheck runs as an app added to the iOS home screen. window.print() does nothing there.
export function isIosStandalone() {
  if (typeof window === 'undefined') return false
  if (window.navigator.standalone === true) return true
  return isIosDevice() && Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
}
