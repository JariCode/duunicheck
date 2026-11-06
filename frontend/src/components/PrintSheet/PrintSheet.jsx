import './PrintSheet.css'
import { dateLabel, safeHttpUrl } from '../../utils'

function CvPrint({ cv }) {
  const links = [['LinkedIn', cv.linkedin], ['GitHub', cv.github], ['Portfolio', cv.portfolio], ['Verkkosivu', cv.website]]
    .map(([label, value]) => [label, safeHttpUrl(value)])
    .filter(([, url]) => url)

  return <>
    <header className="print-brand"><strong><span>D</span> DuuniCheck</strong><small>ANSIOLUETTELO</small></header>
    <section className="cv-print-hero">
      <div><span className="print-kicker">{cv.name || 'ANSIOLUETTELO'}</span><h1>{cv.title || cv.name}</h1>{cv.summary && <p>{cv.summary}</p>}</div>
      {cv.photo && <img className="cv-print-photo" src={cv.photo} alt="" />}
    </section>
    <div className="cv-print-columns">
      <aside className="cv-print-sidebar">
        {cv.skills && <section className="print-section"><h2>Osaaminen</h2><p>{cv.skills}</p></section>}
        {links.length > 0 && <section className="print-section"><h2>Verkossa</h2><ul className="print-links">{links.map(([label, url]) => <li key={label}><b>{label}</b><span>{url.replace(/^https?:\/\//, '')}</span></li>)}</ul></section>}
      </aside>
      <main className="cv-print-main">
        {cv.experience && <section className="print-section"><h2>Työkokemus</h2><p>{cv.experience}</p></section>}
        {cv.education && <section className="print-section"><h2>Koulutus</h2><p>{cv.education}</p></section>}
      </main>
    </div>
  </>
}

function ApplicationPrint({ document }) {
  const { job } = document
  const link = safeHttpUrl(job.link)
  const events = [...(job.events || [])].sort((a, b) => a.date.localeCompare(b.date))
  const metadata = [
    ['Tila', job.status],
    ['Lähetyspäivä', job.added ? dateLabel(job.added) : '—'],
    ['Vastauspäivä', job.respondedAt ? dateLabel(job.respondedAt) : '—'],
    ['Seuraava tehtävä', job.next || '—'],
    ['Muistutuspäivä', job.nextDate ? dateLabel(job.nextDate) : '—'],
  ]

  return <>
    <header className="print-brand"><strong><span>D</span> DuuniCheck</strong><small>HAKEMUKSEN YHTEENVETO</small></header>
    <section className="application-print-hero"><span className="print-kicker">TYÖPAIKKA</span><h1>{job.role}</h1><p>{job.company}{job.place ? ` · ${job.place}` : ''}</p></section>
    <dl className="application-print-meta">{metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {link && <section className="print-section application-print-link"><h2>Työpaikkailmoitus</h2><a href={link}>{link}</a></section>}
    {(document.cvName || document.templateName || document.cvFileName || document.applicationFileNames?.length > 0) && <section className="print-section"><h2>Liitetyt materiaalit</h2><ul className="print-material-list">{document.cvName && <li>CV-versio: {document.cvName}</li>}{document.templateName && <li>Hakemuspohja: {document.templateName}</li>}{document.cvFileName && <li>CV-tiedosto: {document.cvFileName}</li>}{document.applicationFileNames?.map((name) => <li key={name}>Hakemustiedosto: {name}</li>)}</ul></section>}
    {job.notes && <section className="print-section application-print-notes"><h2>Muistiinpanot</h2><p>{job.notes}</p></section>}
    {events.length > 0 && <section className="print-section application-print-history"><h2>Tapahtumahistoria</h2><ol>{events.map((event, index) => <li key={`${event.date}-${event.type}-${index}`}><time>{dateLabel(event.date)}</time><div><b>{event.type}</b>{event.note && <p>{event.note}</p>}</div></li>)}</ol></section>}
  </>
}

export default function PrintSheet({ document }) {
  if (!document) return null
  return <article className={`print-document${document.kind ? ` print-${document.kind}` : ' print-generic'}`}>
    {document.kind === 'cv' ? <CvPrint cv={document.cv} /> : document.kind === 'application' ? <ApplicationPrint document={document} /> : <>
      <header className="print-brand"><strong><span>D</span> DuuniCheck</strong><small>TYÖNHAUN MATERIAALIT</small></header>
      <h1>{document.title}</h1>
      {document.blocks.map((block, index) => <section className="print-section" key={index}><h2>{block.title}</h2><p>{block.body}</p></section>)}
    </>}
  </article>
}
