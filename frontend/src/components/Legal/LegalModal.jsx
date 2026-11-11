import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import KayttoehdotTeksti from './KayttoehdotTeksti.jsx'
import TietosuojaselosteTeksti from './TietosuojaselosteTeksti.jsx'
import { useDialog } from '../../utils/useDialog.js'
import './LegalModal.css'

const pageDetails = {
  kayttoehdot: { title: 'Käyttöehdot', documentTitle: 'Käyttöehdot | DuuniCheck', Content: KayttoehdotTeksti },
  tietosuojaseloste: {
    title: 'Tietosuojaseloste',
    documentTitle: 'Tietosuojaseloste | DuuniCheck',
    Content: TietosuojaselosteTeksti,
  },
}

export default function LegalModal({ page, theme = 'default', onClose }) {
  const details = pageDetails[page]
  const Content = details?.Content
  // The legal dialog can open on top of Clerk's profile modal, so it handles Escape first.
  const panelRef = useDialog({ open: Boolean(details), onClose, initialFocus: 'panel', captureEscape: true })

  useEffect(() => {
    if (!details) return undefined
    const previousTitle = document.title
    const previousOverflow = document.body.style.overflow
    document.title = details.documentTitle
    document.body.style.overflow = 'hidden'
    return () => {
      document.title = previousTitle
      document.body.style.overflow = previousOverflow
    }
  }, [details])

  if (!details || !Content) return null
  const portalTarget = document.querySelector('.cl-modalBackdrop') || document.body

  return createPortal(
    <div
      className="legal-modal-backdrop"
      data-theme={theme}
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        tabIndex="-1"
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="legal-modal-header">
          <h1 id="legal-modal-title">{details.title}</h1>
          <button type="button" className="legal-modal-close" aria-label="Sulje" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="legal-modal-body">
          <Content />
        </div>
      </section>
    </div>,
    portalTarget,
  )
}
