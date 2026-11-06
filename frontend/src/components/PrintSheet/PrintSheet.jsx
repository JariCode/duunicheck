import './PrintSheet.css'
import { safeHttpUrl } from '../../utils'

function personalContact(person) {
  return [person.fullName, person.email, person.phone, person.location]
    .filter(Boolean)
}

function CvPrint({ cv }) {
  const links = [['LinkedIn', cv.linkedin], ['GitHub', cv.github], ['Portfolio', cv.portfolio], ['Verkkosivu', cv.website]]
    .map(([label, value]) => [label, safeHttpUrl(value)])
    .filter(([, url]) => url)
  const contact = personalContact(cv)

  return <>
    <header className="cv-print-hero">
      <div><h1>{cv.fullName}</h1>{cv.title && <p className="cv-print-title">{cv.title}</p>}{cv.summary && <p className="cv-print-summary">{cv.summary}</p>}</div>
      {cv.photo && <img className="cv-print-photo" src={cv.photo} alt="" />}
    </header>
    {contact.length > 0 && <ul className="cv-print-contact">{contact.map((item) => <li key={item}>{item}</li>)}</ul>}
    <div className="cv-print-columns">
      <aside className="cv-print-sidebar">
        {cv.skills && <section className="print-section"><h2>Osaaminen</h2><p>{cv.skills}</p></section>}
        {links.length > 0 && <section className="print-section"><h2>Profiilit ja työnäytteet</h2><ul className="print-links">{links.map(([label, url]) => <li key={label}><b>{label}</b><a href={url}>{url.replace(/^https?:\/\//, '')}</a></li>)}</ul></section>}
      </aside>
      <main className="cv-print-main">
        {cv.experience && <section className="print-section"><h2>Työkokemus</h2><p>{cv.experience}</p></section>}
        {cv.education && <section className="print-section"><h2>Koulutus</h2><p>{cv.education}</p></section>}
      </main>
    </div>
  </>
}

function replaceLetterFields(text, { job, cv }) {
  const values = {
    yritys: job?.company || '', company: job?.company || '', tehtävä: job?.role || '', role: job?.role || '',
    nimi: cv?.fullName || '', name: cv?.fullName || '', sijainti: job?.place || '', place: job?.place || '',
  }
  return text.replace(/\{\{\s*(yritys|company|tehtävä|role|nimi|name|sijainti|place)\s*\}\}/gi, (_, key) => values[key.toLowerCase()] || '')
}

function ApplicationPrint({ document }) {
  const { job = {}, cv = {}, body = '' } = document
  const contact = [cv.email, cv.phone, cv.location].filter(Boolean)
  const letterBody = replaceLetterFields(body, { job, cv }).trim()
  const date = new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const hasGreeting = /^(hei|hyvä|arvoisa)\b/im.test(letterBody)
  const hasClosing = /(ystävällisin terveisin|ystävällisin|terveisin|parhain terveisin)/i.test(letterBody)
  const paragraphs = letterBody ? letterBody.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean) : []

  return <>
    <header className="letter-sender">
      <div className="letter-sender-name"><h1>{cv.fullName}</h1>{cv.title && <p>{cv.title}</p>}</div>
      <ul>{contact.map((item) => <li key={item}>{item}</li>)}</ul>
    </header>
    <div className="letter-address-row"><div className="letter-recipient"><strong>{job.company}</strong>{job.place && <span>{job.place}</span>}</div><time>{date}</time></div>
    <section className="letter-content">
      <h2>{job.role}</h2>
      <div className="letter-body">
        {!hasGreeting && <p>Hyvä rekrytointitiimi,</p>}
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph.split('\n').map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{line}</span>)}</p>)}
        {!hasClosing && <p className="letter-signoff">Ystävällisin terveisin,<br />{cv.fullName}</p>}
      </div>
    </section>
  </>
}

export default function PrintSheet({ document }) {
  if (!document) return null
  const kind = document.kind || 'notes'
  return <article className={`print-document print-${kind}`}>
    {kind === 'cv' ? <CvPrint cv={document.cv} /> : kind === 'application' ? <ApplicationPrint document={document} /> : kind === 'letter' ? <div className="letter-body">{document.body}</div> : <>
      <h1>{document.title}</h1>
      {document.blocks.map((block, index) => <section className="print-section" key={index}><h2>{block.title}</h2><p>{block.body}</p></section>)}
    </>}
  </article>
}
