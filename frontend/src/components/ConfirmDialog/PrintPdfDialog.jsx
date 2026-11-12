import { useEffect, useRef, useState } from 'react'
import { useDialog } from '../../utils/useDialog.js'
import './ConfirmDialog.css'

const safariHelp = 'Avaa duunicheck.jaricode.fi Safarissa, niin voit tulostaa tai tallentaa PDF:n sieltä.'
const retryHelp = 'avaa duunicheck.jaricode.fi Safarissa ja tulosta tai tallenna PDF sieltä.'

// Printing in the iOS home screen app, where window.print() does nothing: the PDF is made on the
// device when the dialog opens, and the button hands it to the iOS share sheet (Tulosta, Tallenna
// tiedostoihin). Safari only allows navigator.share() right after a tap, so the PDF must be ready
// before the button is shown.
export default function PrintPdfDialog({ document, onClose }) {
  const open = Boolean(document)
  const [pdf, setPdf] = useState(null)
  const [error, setError] = useState(null)
  const shareRef = useRef(null)
  const panelRef = useDialog({ open, onClose })

  useEffect(() => {
    if (!document) return undefined
    let current = true
    import('../../utils/printPdf.js')
      .then(async ({ createPrintPdf, pdfTitle }) => {
        const file = await createPrintPdf(document)
        if (current) setPdf({ file, title: pdfTitle(document) })
      })
      .catch((reason) => {
        console.error('PDF creation failed', reason)
        if (current) {
          setError({
            title: 'PDF:n luonti epäonnistui',
            description: `PDF-tiedostoa ei voitu tehdä tällä laitteella. Sulje ikkuna ja yritä uudelleen. Jos virhe toistuu, ${retryHelp}`,
          })
        }
      })
    // The dialog was closed or another document was opened: the result is thrown away and the
    // state cleared, so the next opening starts from scratch.
    return () => {
      current = false
      setPdf(null)
      setError(null)
    }
  }, [document])

  // Keyboard and screen reader users land on the button once the PDF is ready.
  useEffect(() => {
    if (pdf && !error) shareRef.current?.focus()
  }, [pdf, error])

  function share() {
    const data = { files: [pdf.file], title: pdf.title }
    if (typeof navigator.share !== 'function' || !navigator.canShare?.(data)) {
      setError({
        title: 'Jakaminen ei ole käytettävissä',
        description: `Tämä laite ei anna jakaa PDF-tiedostoa sovelluksesta. ${safariHelp}`,
      })
      return
    }
    // Called directly in the click handler, with nothing awaited before it.
    navigator.share(data).then(onClose, (reason) => {
      // The user closed the share sheet; that is not an error.
      if (reason?.name === 'AbortError') return
      console.error('PDF share failed', reason)
      setError({
        title: 'Jakaminen epäonnistui',
        description: `PDF-tiedoston avaaminen jakovalikkoon ei onnistunut. Yritä uudelleen. Jos virhe toistuu, ${retryHelp}`,
        retry: true,
      })
    })
  }

  if (!open) return null
  const busy = !pdf && !error
  const title = error ? error.title : busy ? 'Luodaan PDF:ää…' : 'PDF on valmis'
  const description = error
    ? error.description
    : busy
      ? 'PDF tehdään tällä laitteella. Mitään ei lähetetä palvelimelle.'
      : `${pdf.file.name} on valmis. Valitse jakovalikosta Tulosta tai Tallenna tiedostoihin.`
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
        aria-busy={busy}
        aria-labelledby="print-pdf-dialog-title"
        aria-describedby="print-pdf-dialog-description"
      >
        <span className="confirm-kicker">TULOSTA / TALLENNA PDF</span>
        <div aria-live="polite">
          <h2 id="print-pdf-dialog-title">{title}</h2>
          <p id="print-pdf-dialog-description">{description}</p>
        </div>
        <div className="confirm-actions">
          <button className="confirm-cancel" type="button" onClick={onClose}>
            {busy ? 'Peruuta' : 'Sulje'}
          </button>
          {pdf && (!error || error.retry) && (
            <button ref={shareRef} className="confirm-primary" type="button" onClick={share}>
              Tulosta / jaa PDF
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
