import { useEffect, useRef } from 'react'

// Open dialogs, newest last. Only the topmost dialog reacts to Escape and Tab.
const dialogStack = []

// The element focused before the current one. A field with autoFocus inside a dialog takes focus
// while the dialog is rendered, before the dialog's effect runs, so the opener is the element that
// was focused just before that field.
let previousFocus = null
let currentFocus = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (event) => {
      previousFocus = currentFocus
      currentFocus = event.target
    },
    true,
  )
}

// An open flatpickr date picker, if any. With allowInput the picker does not close on Escape by itself.
function openDatePicker() {
  return [...document.querySelectorAll('.flatpickr-input')]
    .map((input) => input._flatpickr)
    .find((picker) => picker?.isOpen)
}

// Focus goes back to the opener, or to the element with the same data-focus-key when the opener
// has been replaced (for example after the view changed while the dialog was open).
function restoreFocus(opener, openerKey) {
  if (opener?.isConnected && typeof opener.focus === 'function') {
    opener.focus()
    return
  }
  if (openerKey) document.querySelector(`[data-focus-key="${CSS.escape(openerKey)}"]`)?.focus()
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function focusableElements(container) {
  return [...container.querySelectorAll(focusableSelector)].filter((element) => element.getClientRects().length > 0)
}

// Shared behaviour for every modal dialog:
// - focus moves into the dialog when it opens and back to the opener when it closes,
// - Tab and Shift+Tab stay inside the dialog,
// - Escape closes the dialog, but an inner layer closes first: a handler inside the dialog that
//   calls event.preventDefault(), an open date picker, or onEscape returning true.
// initialFocus: 'first' focuses the first focusable element, 'panel' the panel itself, and any
// other string is used as a CSS selector inside the panel.
// captureEscape handles Escape before other listeners (used where the dialog sits on top of a
// Clerk modal, which would otherwise close too). Returns a ref for the dialog panel.
export function useDialog({
  open = true,
  onClose,
  canClose = true,
  onEscape,
  initialFocus = 'first',
  captureEscape = false,
}) {
  const panelRef = useRef(null)
  const handlersRef = useRef({ onClose, canClose, onEscape })

  useEffect(() => {
    handlersRef.current = { onClose, canClose, onEscape }
  })

  useEffect(() => {
    if (!open) return undefined
    const token = {}
    dialogStack.push(token)
    const panel = panelRef.current
    const focusedInside = Boolean(panel?.contains(document.activeElement))
    // A selector given as initialFocus always wins, because the opener itself can be inside the
    // panel (the mobile menu button). Otherwise focus inside the panel comes from an autoFocus field,
    // and the opener is the element focused just before it.
    const explicitTarget = initialFocus !== 'first' && initialFocus !== 'panel'
    const opener = focusedInside && !explicitTarget ? previousFocus : document.activeElement
    const openerKey = opener?.dataset?.focusKey || ''

    // An element with autoFocus inside the dialog has already taken focus; keep it.
    if (panel && (explicitTarget || !focusedInside)) {
      const target =
        initialFocus === 'panel'
          ? panel
          : initialFocus === 'first'
            ? focusableElements(panel)[0]
            : panel.querySelector(initialFocus)
      ;(target || panel).focus()
    }

    const handleEscape = (event) => {
      if (event.defaultPrevented) return
      // An open date picker closes first; the dialog stays open until the next Escape.
      const picker = openDatePicker()
      if (picker) {
        event.preventDefault()
        picker.close()
        return
      }
      const handlers = handlersRef.current
      if (handlers.onEscape?.()) {
        event.preventDefault()
        return
      }
      if (!handlers.canClose) return
      event.preventDefault()
      if (captureEscape) event.stopPropagation()
      handlers.onClose?.()
    }

    const keepTabInside = (event) => {
      const container = panelRef.current
      if (!container) return
      const focusable = focusableElements(container)
      if (!focusable.length) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (!container.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const handleKeyDown = (event) => {
      if (dialogStack.at(-1) !== token) return
      if (event.key === 'Escape') handleEscape(event)
      if (event.key === 'Tab') keepTabInside(event)
    }

    const target = captureEscape ? window : document
    target.addEventListener('keydown', handleKeyDown, captureEscape)
    return () => {
      target.removeEventListener('keydown', handleKeyDown, captureEscape)
      dialogStack.splice(dialogStack.indexOf(token), 1)
      restoreFocus(opener, openerKey)
    }
  }, [open, captureEscape, initialFocus])

  return panelRef
}
