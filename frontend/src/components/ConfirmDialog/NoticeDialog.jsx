import { useDialog } from '../../utils/useDialog.js'
import './ConfirmDialog.css'

// A one-button notice that uses the same look and dialog behaviour as ConfirmDialog.
export default function NoticeDialog({ open, title, description, closeLabel = 'Selvä', onClose }) {
  const panelRef = useDialog({ open, onClose })

  if (!open) return null
  return (
    <div
      className="confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={panelRef}
        tabIndex="-1"
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notice-dialog-title"
        aria-describedby="notice-dialog-description"
      >
        <h2 id="notice-dialog-title">{title}</h2>
        <p id="notice-dialog-description">{description}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
