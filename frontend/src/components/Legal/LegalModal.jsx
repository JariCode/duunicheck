import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import KayttoehdotTeksti from './KayttoehdotTeksti.jsx'
import TietosuojaselosteTeksti from './TietosuojaselosteTeksti.jsx'
import './LegalModal.css'

const pageDetails = {
  kayttoehdot: { title: 'Käyttöehdot', documentTitle: 'Käyttöehdot | DuuniCheck', Content: KayttoehdotTeksti },
  tietosuojaseloste: { title: 'Tietosuojaseloste', documentTitle: 'Tietosuojaseloste | DuuniCheck', Content: TietosuojaselosteTeksti },
}

export default function LegalModal({ page, onClose }) {
  const panelRef = useRef(null)
  const details = pageDetails[page]
  const Content = details?.Content

  useEffect(() => {
    if (!details) return undefined
    const previousTitle = document.title
    const previousOverflow = document.body.style.overflow
    document.title = details.documentTitle
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.title = previousTitle
      document.body.style.overflow = previousOverflow
    }
  }, [details, onClose])

  if (!details || !Content) return null
  const portalTarget = document.querySelector('.cl-modalBackdrop') || document.body

  return createPortal(<div className="legal-modal-backdrop" data-theme={document.documentElement.dataset.duunicheckTheme || 'default'} onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }}>
    <section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" tabIndex="-1" ref={panelRef} onClick={(event) => event.stopPropagation()}>
      <header className="legal-modal-header">
        <h1 id="legal-modal-title">{details.title}</h1>
        <button type="button" className="legal-modal-close" aria-label="Sulje" onClick={onClose}>×</button>
      </header>
      <div className="legal-modal-body"><Content /></div>
    </section>
  </div>, portalTarget)
}
