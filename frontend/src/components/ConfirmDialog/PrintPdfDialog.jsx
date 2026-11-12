import { useEffect, useRef, useState } from 'react'
import { useDialog } from '../../utils/useDialog.js'
import './ConfirmDialog.css'

const safariHelp = 'Avaa duunicheck.jaricode.fi Safarissa, niin voit tulostaa tai tallentaa PDF:n sieltä.'
const retryHelp = 'avaa duunicheck.jaricode.fi Safarissa ja tulosta tai tallenna PDF sieltä.'
// How long an opened PDF keeps its blob URL after the dialog closes, so the new tab has time to load it.
const revokeDelay = 60_000

// Printing where window.print() is not used. The PDF is made on the device when the dialog opens, and
// the button is shown once it is ready, because Safari only allows these actions right after a click:
// - mode 'share' (the iOS home screen app, where window.print() does nothing): the button hands the PDF
//   to the iOS share sheet (Tulosta, Tallenna tiedostoihin).
// - mode 'open' (Safari and the Dock app on a Mac, where window.print() places the document too high
//   on the paper): the button opens the PDF in a new tab, in Safari's PDF view, which prints it exactly
//   (Cmd+P). If the new tab is blocked, the PDF is downloaded instead.
export default function PrintPdfDialog({ document, mode = 'share', onClose }) {
  const open = Boolean(document)
  const opensPdf = mode === 'open'
  const [pdf, setPdf] = useState(null)
  const [error, setError] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const shareRef = useRef(null)
  const urlRef = useRef(null)
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
            description: opensPdf
              ? 'PDF-tiedostoa ei voitu tehdä. Sulje ikkuna ja yritä uudelleen. Jos virhe toistuu, lataa sivu uudelleen ja yritä vielä kerran.'
              : `PDF-tiedostoa ei voitu tehdä tällä laitteella. Sulje ikkuna ja yritä uudelleen. Jos virhe toistuu, ${retryHelp}`,
          })
        }
      })
    // The dialog was closed or another document was opened: the result is thrown away and the
    // state cleared, so the next opening starts from scratch.
    return () => {
      current = false
      setPdf(null)
      setError(null)
      setDownloaded(false)
      const url = urlRef.current
      urlRef.current = null
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), revokeDelay)
    }
  }, [document, opensPdf])

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

  // Called directly in the click handler, with nothing awaited before it, so Safari allows the new tab.
  function openPdf() {
    urlRef.current ||= URL.createObjectURL(pdf.file)
    if (window.open(urlRef.current, '_blank')) {
      onClose()
      return
    }
    // The new tab was blocked: the PDF is downloaded instead.
    const link = window.document.createElement('a')
    link.href = urlRef.current
    link.download = pdf.file.name
    window.document.body.append(link)
    link.click()
    link.remove()
    setDownloaded(true)
  }

  if (!open) return null
  const busy = !pdf && !error
  const title = error
    ? error.title
    : busy
      ? 'Luodaan PDF:ää…'
      : downloaded
        ? 'PDF ladattiin tiedostona'
        : 'PDF on valmis'
  const description = error
    ? error.description
    : busy
      ? 'PDF tehdään tällä laitteella. Mitään ei lähetetä palvelimelle.'
      : !opensPdf
        ? `${pdf.file.name} on valmis. Valitse jakovalikosta Tulosta tai Tallenna tiedostoihin.`
        : downloaded
          ? `Selain ei avannut uutta välilehteä, joten ${pdf.file.name} ladattiin Lataukset-kansioon. Löydät sen Safarin latauksista (nuolipainike työkalupalkissa) tai Finderista kohdasta Lataukset. Avaa tiedosto ja tulosta se: Cmd+P. Jos Safari kysyy, sallitaanko lataukset tältä sivustolta, valitse Salli ja paina Avaa PDF uudelleen.`
          : `${pdf.file.name} on valmis. Avaa PDF painamalla nappia: se avautuu uuteen välilehteen, jossa voit tulostaa sen (Cmd+P) tai tallentaa.`
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
            <button ref={shareRef} className="confirm-primary" type="button" onClick={opensPdf ? openPdf : share}>
              {opensPdf ? 'Avaa PDF' : 'Tulosta / jaa PDF'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
