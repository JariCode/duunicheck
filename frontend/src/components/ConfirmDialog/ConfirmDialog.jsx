import { useDialog } from '../../utils/useDialog.js'
import './ConfirmDialog.css'

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Poista',
  // 'danger' for deletions (the default), 'primary' for confirming a save.
  confirmTone = 'danger',
  busyLabel = 'Poistetaan…',
  busy = false,
  onConfirm,
  onCancel,
  // Optional extra content under the description, such as a choice or a warning.
  children = null,
}) {
  // Focus starts on Peruuta, so Enter never confirms a deletion by accident.
  const panelRef = useDialog({ open, onClose: onCancel, canClose: !busy })

  if (!open) return null
  return (
    <div
      className="confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <section
        ref={panelRef}
        tabIndex="-1"
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <span className="confirm-kicker">VAHVISTA TOIMINTO</span>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        {children}
        <div className="confirm-actions">
          <button className="confirm-cancel" type="button" onClick={onCancel} disabled={busy}>
            Peruuta
          </button>
          <button
            className={confirmTone === 'primary' ? 'confirm-primary' : 'confirm-danger'}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
