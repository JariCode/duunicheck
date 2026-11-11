// True on touch devices, where focusing a field opens the on-screen keyboard.
export function isCoarsePointer() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)
}
