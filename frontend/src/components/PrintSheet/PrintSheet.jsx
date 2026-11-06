import './PrintSheet.css'
import { safeHttpUrl } from '../../utils'

function profileLinks(person) {
  return [['LinkedIn', person.linkedin], ['GitHub', person.github], ['Portfolio', person.portfolio], ['Verkkosivu', person.website]]
    .map(([label, value]) => [label, safeHttpUrl(value)])
    .filter(([, url]) => url)
}

function CvBulletSection({ title, value }) {
  const items = String(value || '').split(/\r?\n/).map((item) => item.replace(/^\s*[•*-]\s*/, '').trim()).filter(Boolean)
  if (!items.length) return null
  return <section className="print-section cv-list-section"><h2>{title}</h2><ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>
}

function CvExperience({ value }) {
  const entries = String(value || '').split(/\n\s*\n/).map((entry) => entry.trim()).filter(Boolean)
  if (!entries.length) return null
  return <section className="print-section cv-experience"><h2>Työkokemus</h2><div className="cv-experience-list">{entries.map((entry, index) => {
    const [heading, ...details] = entry.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    return <article key={`${index}-${heading}`}><h3>{heading}</h3>{details.length > 0 && <p>{details.join('\n')}</p>}</article>
  })}</div></section>
}

function CvPrint({ cv }) {
  const links = profileLinks(cv)

  return <>
    <header className="cv-print-hero">
      <div><h1>{cv.fullName}</h1>{cv.title && <p className="cv-print-title">{cv.title}</p>}{cv.summary && <p className="cv-print-summary">{cv.summary}</p>}</div>
      {cv.photo && <img className="cv-print-photo" src={cv.photo} alt="" />}
    </header>
    {(cv.email || cv.phone) && <section className="cv-print-contact" aria-label="Yhteystiedot"><h2>Yhteystiedot</h2><div>{cv.email && <p><span>Sähköposti</span><a href={`mailto:${cv.email}`}>{cv.email}</a></p>}{cv.phone && <p><span>Puhelin</span><a href={`tel:${cv.phone.replace(/[^+\d]/g, '')}`}>{cv.phone}</a></p>}</div></section>}
    <div className="cv-print-columns">
      <aside className="cv-print-sidebar">
        <CvBulletSection title="IT-taidot" value={cv.skills} />
        <CvBulletSection title="Kielitaito" value={cv.languages} />
        {links.length > 0 && <section className="print-section"><h2>Linkit</h2><ul className="print-links">{links.map(([label, url]) => <li key={label}><b>{label}</b><a href={url}>{url.replace(/^https?:\/\//, '')}</a></li>)}</ul></section>}
      </aside>
      <main className="cv-print-main">
        <CvExperience value={cv.experience} />
        <CvBulletSection title="Koulutus" value={cv.education} />
        <CvBulletSection title="Sertifikaatit" value={cv.certificates} />
        <CvBulletSection title="Kurssit" value={cv.courses} />
        {cv.hobbies && <section className="print-section"><h2>Harrastukset</h2><p>{cv.hobbies}</p></section>}
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
  const contact = [cv.email, cv.phone].filter(Boolean)
  const links = profileLinks(cv)
  const letterBody = replaceLetterFields(body, { job, cv }).trim()
  const date = new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const hasGreeting = /^(hei|hyvä|arvoisa)\b/im.test(letterBody)
  const hasClosing = /(ystävällisin terveisin|ystävällisin|terveisin|parhain terveisin)/i.test(letterBody)
  const paragraphs = letterBody ? letterBody.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => {
    const lines = part.split(/\r?\n/)
    const heading = lines[0].match(/^#\s+(.+)$/)?.[1] || ''
    if (heading) lines.shift()
    return { heading, text: lines.join('\n').trim() }
  }) : []

  return <>
    <header className="letter-titlebar">HAKUKIRJE</header>
    <header className="letter-sender">
      <div className="letter-sender-name"><h1>{cv.fullName}</h1>{cv.title && <p>{cv.title}</p>}</div>
      <ul>{contact.map((item) => <li key={item}>{item}</li>)}</ul>
    </header>
    {(job.company || job.place || job.role || !job) && <div className="letter-address-row">{(job.company || job.place) && <div className="letter-recipient"><span className="letter-label">Vastaanottaja</span>{job.company && <strong>{job.company}</strong>}{job.place && <span>{job.place}</span>}</div>}<time><span className="letter-label">Päiväys</span>{date}</time></div>}
    <section className="letter-content">
      {job.role && <><span className="letter-label">Haettava tehtävä</span><h2>{job.role}</h2></>}
      <div className="letter-body">
        {!hasGreeting && <p>Hei,</p>}
        {paragraphs.map(({ heading, text }, index) => heading ? <section className="letter-text-section" key={`${heading}-${index}`}><h3>{heading}</h3><p>{text.split('\n').map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{line}</span>)}</p></section> : <p className="letter-paragraph" key={index}>{text.split('\n').map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{line}</span>)}</p>)}
        {!hasClosing && <p className="letter-signoff">Ystävällisin terveisin,<br />{cv.fullName}</p>}
      </div>
    </section>
    {links.length > 0 && <footer className="letter-links"><h2>Linkit</h2><ul>{links.map(([label, url]) => <li key={label}><strong>{label}</strong><a href={url}>{url.replace(/^https?:\/\//, '')}</a></li>)}</ul></footer>}
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
