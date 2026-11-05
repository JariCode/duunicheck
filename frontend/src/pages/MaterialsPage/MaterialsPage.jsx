import './MaterialsPage.css'
import { useState } from 'react'
function emptyCv() { return { name: '', title: '', summary: '', skills: '', experience: '', education: '' } }
function emptyTemplate() { return { name: '', body: '' } }
export default function MaterialsPage({ cvs, setCvs, templates, setTemplates, onPrint }) {
  const [cvForm, setCvForm] = useState(null)
  const [templateForm, setTemplateForm] = useState(null)
  const saveCv = (event) => {
    event.preventDefault()
    const cv = { ...cvForm, name: cvForm.name.trim(), id: cvForm.id || 'cv-' + Date.now() }
    setCvs((all) => cvForm.id ? all.map((item) => item.id === cv.id ? cv : item) : [cv, ...all])
    setCvForm(null)
  }
  const saveTemplate = (event) => {
    event.preventDefault()
    const template = { ...templateForm, name: templateForm.name.trim(), id: templateForm.id || 'template-' + Date.now() }
    setTemplates((all) => templateForm.id ? all.map((item) => item.id === template.id ? template : item) : [template, ...all])
    setTemplateForm(null)
  }
  const printCv = (cv) => onPrint({ title: cv.name, blocks: [{ title: cv.title, body: cv.summary }, { title: 'Osaaminen', body: cv.skills }, { title: 'Työkokemus', body: cv.experience }, { title: 'Koulutus', body: cv.education }] })
  return <div className="materials-page">
    <section className="materials-intro"><div><span className="eyebrow">OMA MATERIAALIKIRJASTO</span><h2>CV:t ja hakemuspohjat</h2><p>Ylläpidä omia CV-versioita ja yleisiä pohjia. Valitse sopiva CV hakemukselle; hakemuksen teksti tallentuu sen omana muokattuna versiona.</p></div><button className="add-button" onClick={() => setCvForm(emptyCv())}>＋ Lisää CV</button></section>
    <section className="materials-section"><div className="materials-heading"><div><h3>Omat CV:t</h3><p>Muokkaa yhtä CV:tä ja päivitä sitä uudelleen käytettäväksi.</p></div></div>
      <div className="material-grid">{cvs.map((cv) => <article className="material-card" key={cv.id}><span className="material-type">CV-VERSIO</span><h4>{cv.name}</h4><b>{cv.title}</b><p>{cv.summary}</p><small>Osaaminen: {cv.skills}</small><div className="material-actions"><button onClick={() => setCvForm({ ...cv })}>Muokkaa / päivitä</button><button onClick={() => printCv(cv)}>Tulosta / tallenna PDF</button><button className="delete-material" onClick={() => setCvs((all) => all.filter((item) => item.id !== cv.id))}>Poista</button></div></article>)}
      {!cvs.length && <p className="empty">CV-kirjastossa ei ole vielä CV:tä. Lisää CV tai sen tiedot tähän.</p>}</div>
    </section>
    <section className="materials-section"><div className="materials-heading"><div><h3>Hakemuspohjat</h3><p>Pohjasta kopioidaan teksti hakemukseen. Muokattu teksti pysyy hakemuskohtaisena.</p></div><button className="materials-secondary" onClick={() => setTemplateForm(emptyTemplate())}>＋ Lisää pohja</button></div>
      <div className="material-grid">{templates.map((template) => <article className="material-card template-card" key={template.id}><span className="material-type">HAKEMUSPOHJA</span><h4>{template.name}</h4><p className="template-preview">{template.body}</p><div className="material-actions"><button onClick={() => setTemplateForm({ ...template })}>Muokkaa pohjaa</button><button onClick={() => onPrint({ title: template.name, blocks: [{ title: 'Hakemuspohja', body: template.body }] })}>Tulosta / tallenna PDF</button><button className="delete-material" onClick={() => setTemplates((all) => all.filter((item) => item.id !== template.id))}>Poista</button></div></article>)}
      {!templates.length && <p className="empty">Lisää hakemuspohja, niin voit käyttää sitä hakemuksissa.</p>}</div>
    </section>
    <p className="materials-note">Selaindemossa muutokset säilyvät vain sivun auki ollessa. CV-tiedostojen lataus ja pysyvä versiohistoria kytketään tallennukseen backend-vaiheessa.</p>
    {cvForm && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCvForm(null) }}><form className="form-card material-editor" onSubmit={saveCv}><div className="form-heading"><div><span className="eyebrow">OMA CV-KIRJASTO</span><h2>{cvForm.id ? 'Muokkaa CV:tä' : 'Lisää CV'}</h2></div><button type="button" onClick={() => setCvForm(null)} aria-label="Sulje">×</button></div><label>CV:n nimi<input required maxLength="120" value={cvForm.name} onChange={(e) => setCvForm({ ...cvForm, name: e.target.value })} placeholder="Esim. Frontend-kehittäjän CV" /></label><label>Ammatillinen otsikko<input maxLength="160" value={cvForm.title} onChange={(e) => setCvForm({ ...cvForm, title: e.target.value })} placeholder="Esim. Frontend-kehittäjä" /></label><label>Profiiliteksti<textarea rows="4" maxLength="3000" value={cvForm.summary} onChange={(e) => setCvForm({ ...cvForm, summary: e.target.value })} /></label><label>Osaaminen<textarea rows="3" maxLength="3000" value={cvForm.skills} onChange={(e) => setCvForm({ ...cvForm, skills: e.target.value })} /></label><label>Työkokemus<textarea rows="5" maxLength="8000" value={cvForm.experience} onChange={(e) => setCvForm({ ...cvForm, experience: e.target.value })} /></label><label>Koulutus<textarea rows="3" maxLength="3000" value={cvForm.education} onChange={(e) => setCvForm({ ...cvForm, education: e.target.value })} /></label><div className="form-actions"><button className="cancel" type="button" onClick={() => setCvForm(null)}>Peruuta</button><button className="add-button" type="submit">Tallenna CV →</button></div></form></div>}
    {templateForm && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplateForm(null) }}><form className="form-card material-editor" onSubmit={saveTemplate}><div className="form-heading"><div><span className="eyebrow">HAKEMUSPOHJA</span><h2>{templateForm.id ? 'Muokkaa pohjaa' : 'Lisää pohja'}</h2></div><button type="button" onClick={() => setTemplateForm(null)} aria-label="Sulje">×</button></div><label>Pohjan nimi<input required maxLength="120" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Esim. Avoin hakemus" /></label><label>Pohjan teksti<textarea required rows="12" maxLength="12000" value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} /></label><div className="form-actions"><button className="cancel" type="button" onClick={() => setTemplateForm(null)}>Peruuta</button><button className="add-button" type="submit">Tallenna pohja →</button></div></form></div>}
  </div>
}
