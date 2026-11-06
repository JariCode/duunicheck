import './MaterialsPage.css'
import { useRef, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import { safeHttpUrl } from '../../utils'

function emptyCv() { return { name: '', fullName: '', email: '', phone: '', title: '', summary: '', skills: '', experience: '', education: '', certificates: '', courses: '', languages: '', hobbies: '', linkedin: '', github: '', portfolio: '', website: '', photo: '' } }
function emptyTemplate() { return { name: '', fullName: '', email: '', phone: '', body: '', linkedin: '', github: '', portfolio: '', website: '' } }
function cvListItems(value) {
  const text = String(value || '')
  if (!text.trim()) return text ? [''] : []
  return text.split(/\r?\n/).map((item) => item.replace(/^\s*[•*-]\s*/, '').trim())
}
function saveCvListItems(items) {
  return items.map((item) => item.trim()).filter(Boolean).join('\n')
}
function CvListEditor({ label, value, onChange, placeholder }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const items = cvListItems(value)
  const updateItems = (next) => onChange(saveCvListItems(next))
  const commitItem = (event) => {
    event?.preventDefault()
    const nextItem = draft.trim()
    if (!nextItem) return
    updateItems([...items, nextItem])
    setDraft('')
    setAdding(false)
  }
  return <fieldset className="cv-list-editor"><legend><span>{label}</span><small>{items.length} kohtaa</small></legend>
    <div className="cv-list-content">{items.length ? items.map((item, index) => <span className="cv-list-chip" key={`${index}-${item}`}><input maxLength="700" value={item} aria-label={`${label}, kohta ${index + 1}`} onChange={(event) => { const next = [...items]; next[index] = event.target.value; onChange(saveCvListItems(next)) }} placeholder={placeholder} style={{ width: `${Math.max(5, Math.min(28, item.length + 1))}ch` }} /><button type="button" className="cv-list-remove" aria-label={`Poista ${label.toLowerCase()} kohta ${index + 1}`} onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>) : <small className="cv-list-empty">Ei lisättyjä kohtia</small>}</div>
    {adding ? <div className="cv-list-add-form"><input autoFocus maxLength="700" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setDraft(''); setAdding(false) } else if (event.key === 'Enter') commitItem(event) }} aria-label={`Uusi ${label.toLowerCase()} kohta`} placeholder={placeholder || `Uusi ${label.toLowerCase()} kohta`} /><button type="button" aria-label={`Lisää ${label.toLowerCase()} kohta`} disabled={!draft.trim()} onClick={commitItem}>＋</button><button type="button" aria-label="Peruuta lisäys" onClick={() => { setDraft(''); setAdding(false) }}>×</button></div> : <button type="button" className="cv-list-add" onClick={() => setAdding(true)}>＋ Lisää kohta</button>}
  </fieldset>
}
const fileAccept = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
const fileLibraries = [
  { category: 'cv', title: 'CV-tiedostot', description: 'Säilytä alkuperäiset CV:tiedostosi täällä, erillään CV:n muokattavista tekstiversioista.' },
  { category: 'application', title: 'Hakemustiedostot', description: 'Lisää työhakemuksia ja muita työnhaun asiakirjoja.' },
]

function formatSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} kt`
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} Mt`
}

function FileLibrary({ category, title, description, files, uploading, setUploading, onUpload, onDownload, onDelete, onError }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const handleFiles = async (list) => {
    const selected = Array.from(list || [])
    if (!selected.length) return
    setUploading(category)
    try {
      for (const file of selected) {
        try { await onUpload(category, file) } catch (error) { onError(error.message) }
      }
    } finally {
      setUploading('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }
  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    void handleFiles(event.dataTransfer.files)
  }
  const categoryFiles = files.filter((file) => file.category === category)

  return <section className="file-library">
    <div className="file-library-heading"><div><h3>{title}</h3><p>{description}</p></div><span>{categoryFiles.length} tiedostoa</span></div>
    <div className={`file-dropzone${dragging ? ' is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={onDrop}>
      <input ref={inputRef} type="file" accept={fileAccept} multiple onChange={(event) => void handleFiles(event.target.files)} aria-label={`Lisää tiedostoja: ${title}`} />
      <span className="file-drop-icon" aria-hidden="true">↑</span>
      <div><strong>{uploading === category ? 'Tallennetaan tiedostoa…' : 'Pudota tiedostot tähän'}</strong><small>tai valitse laitteelta · PDF, DOCX tai TXT · enintään 10 Mt / tiedosto</small></div>
      <button type="button" className="materials-secondary" disabled={Boolean(uploading)} onClick={() => inputRef.current?.click()}>Valitse tiedostot</button>
    </div>
    {categoryFiles.length > 0 ? <ul className="uploaded-file-list">{categoryFiles.map((file) => <li key={file.id}>
      <span className="file-badge">{file.name.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'}</span>
      <span className="uploaded-file-info"><strong title={file.name}>{file.name}</strong><small>{formatSize(file.size)} · {new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(file.createdAt))}</small></span>
      <button type="button" onClick={() => onDownload(file)}>Lataa</button>
      <button type="button" className="delete-material" onClick={() => onDelete(file)}>Poista</button>
    </li>)}</ul> : <p className="file-library-empty">Tähän ei ole vielä lisätty tiedostoja.</p>}
  </section>
}

export default function MaterialsPage({ cvs, templates, files, onPrint, onSaveCv, onDeleteCv, onSaveTemplate, onDeleteTemplate, onUploadFile, onDownloadFile, onDeleteFile, onError }) {
  const photoInputRef = useRef(null)
  const [cvForm, setCvForm] = useState(null)
  const [templateForm, setTemplateForm] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState('')
  const saveCv = async (event) => {
    event.preventDefault()
    try { await onSaveCv({ ...cvForm, name: cvForm.name.trim() }); setCvForm(null) } catch (error) { onError(error.message) }
  }
  const chooseCvPhoto = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onError('CV-kuvan pitää olla JPG-, PNG- tai WebP-kuva.')
      return
    }
    if (file.size > 512 * 1024) {
      onError('CV-kuvan enimmäiskoko on 512 kt.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setCvForm((current) => current ? { ...current, photo: reader.result } : current)
    }
    reader.onerror = () => onError('CV-kuvan lukeminen epäonnistui.')
    reader.readAsDataURL(file)
  }
  const saveTemplate = async (event) => {
    event.preventDefault()
    try { await onSaveTemplate({ ...templateForm, name: templateForm.name.trim() }); setTemplateForm(null) } catch (error) { onError(error.message) }
  }
  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      if (pendingDelete.kind === 'cv') await onDeleteCv(pendingDelete.id)
      else if (pendingDelete.kind === 'template') await onDeleteTemplate(pendingDelete.id)
      else await onDeleteFile(pendingDelete.id)
    } catch (error) {
      onError(error.message)
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }
  const printCv = (cv) => onPrint({ kind: 'cv', title: cv.name, cv })
  return <div className="materials-page">
    <section className="file-libraries"><div className="materials-heading"><div><h3>Tiedostot</h3><p>Vedä tiedostot laatikkoon tai valitse ne laitteeltasi. Tiedostot tallennetaan omalle käyttäjätilillesi.</p></div></div>
      <div className="file-library-grid">{fileLibraries.map((library) => <FileLibrary key={library.category} {...library} files={files} uploading={uploading} setUploading={setUploading} onUpload={onUploadFile} onError={onError} onDownload={onDownloadFile} onDelete={(file) => setPendingDelete({ kind: 'file', id: file.id, name: file.name })} />)}</div>
    </section>
    <section className="materials-section"><div className="materials-heading"><div><h3>Omat CV:t</h3><p>Muokkaa yhtä CV:tä ja päivitä sitä uudelleen käytettäväksi.</p></div><div className="materials-heading-actions"><button className="add-button" onClick={() => setCvForm(emptyCv())}>＋ Lisää CV</button></div></div>
      <div className="material-grid">{cvs.map((cv) => <article className="material-card" key={cv.id}><span className="material-type">CV-VERSIO</span>{cv.photo && <img className="cv-card-photo" src={cv.photo} alt="" />}<h4>{cv.name}</h4><b>{cv.title}</b><p>{cv.summary}</p>{[cv.linkedin, cv.github, cv.portfolio, cv.website].some((url) => safeHttpUrl(url)) && <div className="cv-social-links">{[['LinkedIn', cv.linkedin], ['GitHub', cv.github], ['Portfolio', cv.portfolio], ['Verkkosivu', cv.website]].filter(([, url]) => safeHttpUrl(url)).map(([label, url]) => <a key={label} href={safeHttpUrl(url)} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}</div>}<small>IT-taidot: {cv.skills}</small><div className="material-actions"><button onClick={() => setCvForm({ ...cv, location: undefined, photo: cv.photo || '' })}>Muokkaa / päivitä</button><button onClick={() => printCv(cv)}>Tulosta / tallenna PDF</button><button className="delete-material" onClick={() => setPendingDelete({ kind: 'cv', id: cv.id, name: cv.name })}>Poista</button></div></article>)}
      {!cvs.length && <p className="empty">CV-kirjastossa ei ole vielä CV:tä. Lisää CV tai sen tiedot tähän.</p>}</div>
    </section>
    <section className="materials-section"><div className="materials-heading"><div><h3>Hakemuspohjat</h3><p>Pohjasta kopioidaan teksti hakemukseen. Muokattu teksti pysyy hakemuskohtaisena.</p></div><div className="materials-heading-actions"><button className="materials-secondary" onClick={() => setTemplateForm(emptyTemplate())}>＋ Lisää pohja</button></div></div>
      <div className="material-grid">{templates.map((template) => <article className="material-card template-card" key={template.id}><span className="material-type">HAKEMUSPOHJA</span><h4>{template.name}</h4><p className="template-preview">{template.body}</p><div className="material-actions"><button onClick={() => setTemplateForm({ ...emptyTemplate(), ...template })}>Muokkaa pohjaa</button><button onClick={() => onPrint({ kind: 'application', job: {}, cv: template, body: template.body })}>Tulosta / tallenna PDF</button><button className="delete-material" onClick={() => setPendingDelete({ kind: 'template', id: template.id, name: template.name })}>Poista</button></div></article>)}
      {!templates.length && <p className="empty">Lisää hakemuspohja, niin voit käyttää sitä hakemuksissa.</p>}</div>
    </section>
    <p className="materials-note">CV:t ja hakemuspohjat tallentuvat käyttäjätilillesi ja pysyvät siellä kirjautumiskertojen välillä.</p>
    {cvForm && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCvForm(null) }}><form className="form-card material-editor cv-editor" onSubmit={saveCv}><div className="form-heading"><div><span className="eyebrow">OMA CV-KIRJASTO</span><h2>{cvForm.id ? 'Muokkaa CV:tä' : 'Lisää CV'}</h2></div><button type="button" onClick={() => setCvForm(null)} aria-label="Sulje">×</button></div><div className="cv-editor-grid">
<label>CV:n nimi<input required maxLength="120" value={cvForm.name} onChange={(e) => setCvForm({ ...cvForm, name: e.target.value })} placeholder="Esim. Frontend-kehittäjän CV" /></label>
<div className="form-pair"><label>Koko nimi<input required maxLength="160" value={cvForm.fullName || ''} onChange={(e) => setCvForm({ ...cvForm, fullName: e.target.value })} placeholder="Etunimi Sukunimi" /></label><label>Ammatillinen otsikko<input maxLength="160" value={cvForm.title} onChange={(e) => setCvForm({ ...cvForm, title: e.target.value })} placeholder="Esim. Frontend-kehittäjä" /></label></div>
<div className="form-pair"><label>Sähköposti<input type="email" maxLength="254" value={cvForm.email || ''} onChange={(e) => setCvForm({ ...cvForm, email: e.target.value })} placeholder="nimi@esimerkki.fi" /></label><label>Puhelin<input type="tel" maxLength="40" value={cvForm.phone || ''} onChange={(e) => setCvForm({ ...cvForm, phone: e.target.value })} placeholder="+358 ..." /></label></div>
<div className="cv-photo-field"><div className="cv-photo-control"><strong>CV-kuva</strong><small>JPG, PNG tai WebP · enintään 512 kt</small><div className="cv-photo-picker"><input hidden ref={photoInputRef} className="cv-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseCvPhoto} /><button className="file-picker-button" type="button" onClick={() => photoInputRef.current?.click()}>Valitse kuva</button><span className="cv-photo-file-name">{cvForm.photo ? 'Kuva lisätty' : 'Ei kuvaa valittuna'}</span></div></div>{cvForm.photo && <div className="cv-photo-preview"><img src={cvForm.photo} alt="CV-kuvan esikatselu" /><button className="materials-secondary" type="button" onClick={() => setCvForm({ ...cvForm, photo: '' })}>Poista kuva</button></div>}</div>
<label>LinkedIn-profiili<input type="url" maxLength="2048" value={cvForm.linkedin || ''} onChange={(e) => setCvForm({ ...cvForm, linkedin: e.target.value })} placeholder="https://www.linkedin.com/in/..." /></label>
<label>GitHub<input type="url" maxLength="2048" value={cvForm.github || ''} onChange={(e) => setCvForm({ ...cvForm, github: e.target.value })} placeholder="https://github.com/..." /></label>
<label>Portfolio / työnäytteet<input type="url" maxLength="2048" value={cvForm.portfolio || ''} onChange={(e) => setCvForm({ ...cvForm, portfolio: e.target.value })} placeholder="https://..." /></label>
<label>Muu verkkosivu<input type="url" maxLength="2048" value={cvForm.website || ''} onChange={(e) => setCvForm({ ...cvForm, website: e.target.value })} placeholder="https://..." /></label>
<label>Profiiliteksti<textarea rows="3" maxLength="3000" value={cvForm.summary} onChange={(e) => setCvForm({ ...cvForm, summary: e.target.value })} /></label>
<CvListEditor label="IT-taidot" value={cvForm.skills} onChange={(skills) => setCvForm({ ...cvForm, skills })} placeholder="Esim. JavaScript" />
<label>Työkokemus<textarea rows="4" maxLength="8000" value={cvForm.experience} onChange={(e) => setCvForm({ ...cvForm, experience: e.target.value })} /></label>
<CvListEditor label="Koulutus" value={cvForm.education} onChange={(education) => setCvForm({ ...cvForm, education })} placeholder="Tutkinto, oppilaitos ja valmistumisvuosi" />
<CvListEditor label="Sertifikaatit" value={cvForm.certificates || ''} onChange={(certificates) => setCvForm({ ...cvForm, certificates })} placeholder="Sertifikaatin nimi" />
<CvListEditor label="Kurssit" value={cvForm.courses || ''} onChange={(courses) => setCvForm({ ...cvForm, courses })} placeholder="Kurssin nimi ja ajankohta" />
<CvListEditor label="Kielitaito" value={cvForm.languages || ''} onChange={(languages) => setCvForm({ ...cvForm, languages })} placeholder="Kieli ja taitotaso" />
<label>Harrastukset<textarea rows="2" maxLength="3000" value={cvForm.hobbies || ''} onChange={(e) => setCvForm({ ...cvForm, hobbies: e.target.value })} /></label>
</div><div className="form-actions"><button className="cancel" type="button" onClick={() => setCvForm(null)}>Peruuta</button><button className="add-button" type="submit">Tallenna CV →</button></div></form></div>}
    {templateForm && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplateForm(null) }}><form className="form-card material-editor template-editor" onSubmit={saveTemplate}><div className="form-heading"><div><span className="eyebrow">HAKEMUSPOHJA</span><h2>{templateForm.id ? 'Muokkaa pohjaa' : 'Lisää pohja'}</h2></div><button type="button" onClick={() => setTemplateForm(null)} aria-label="Sulje">×</button></div><label>Pohjan nimi<input required maxLength="120" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Esim. Avoin hakemus" /></label><fieldset className="template-section"><legend>Nimi ja yhteystiedot</legend><p>Nämä tiedot tulostuvat hakukirjeen alkuun. Voit käyttää CV:n tietoja tai antaa tähän pohjaan omat tiedot.</p><div className="form-pair"><label>Nimi<input maxLength="160" value={templateForm.fullName || ''} onChange={(e) => setTemplateForm({ ...templateForm, fullName: e.target.value })} placeholder="Etunimi Sukunimi" /></label><label>Puhelin<input type="tel" maxLength="40" value={templateForm.phone || ''} onChange={(e) => setTemplateForm({ ...templateForm, phone: e.target.value })} placeholder="+358 ..." /></label></div><label>Sähköposti<input type="email" maxLength="254" value={templateForm.email || ''} onChange={(e) => setTemplateForm({ ...templateForm, email: e.target.value })} placeholder="nimi@esimerkki.fi" /></label></fieldset><fieldset className="template-section"><legend>Hakuteksti</legend><label>Hakukirjeen sisältö<textarea required rows="10" maxLength="20000" value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} placeholder="Kirjoita hakukirjeesi tähän. Erota kappaleet tyhjällä rivillä." /></label><small className="template-placeholder-help">Väliotsikon saat tulosteeseen aloittamalla rivin #-merkillä. Voit käyttää tunnisteita {'{{yritys}}'}, {'{{tehtävä}}'}, {'{{nimi}}'} ja {'{{sijainti}}'}.</small></fieldset><fieldset className="template-section"><legend>Linkit</legend><p>Nämä tulostuvat hakukirjeen loppuun. Tyhjäksi jätetyt linkit ohitetaan.</p><div className="form-pair"><label>LinkedIn<input type="url" maxLength="2048" value={templateForm.linkedin || ''} onChange={(e) => setTemplateForm({ ...templateForm, linkedin: e.target.value })} placeholder="https://www.linkedin.com/in/..." /></label><label>GitHub<input type="url" maxLength="2048" value={templateForm.github || ''} onChange={(e) => setTemplateForm({ ...templateForm, github: e.target.value })} placeholder="https://github.com/..." /></label><label>Portfolio / työnäytteet<input type="url" maxLength="2048" value={templateForm.portfolio || ''} onChange={(e) => setTemplateForm({ ...templateForm, portfolio: e.target.value })} placeholder="https://..." /></label><label>Muu verkkosivu<input type="url" maxLength="2048" value={templateForm.website || ''} onChange={(e) => setTemplateForm({ ...templateForm, website: e.target.value })} placeholder="https://..." /></label></div></fieldset><div className="form-actions"><button className="cancel" type="button" onClick={() => setTemplateForm(null)}>Peruuta</button><button className="add-button" type="submit">Tallenna pohja →</button></div></form></div>}
    <ConfirmDialog open={Boolean(pendingDelete)} title={pendingDelete?.kind === 'cv' ? 'Poistetaanko CV?' : pendingDelete?.kind === 'template' ? 'Poistetaanko hakemuspohja?' : 'Poistetaanko tiedosto?'} description={pendingDelete ? `“${pendingDelete.name}” poistetaan pysyvästi käyttäjätililtäsi.` : ''} busy={deleting} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
  </div>
}
