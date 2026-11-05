import './ApplicationForm.css'
import { stages } from '../../utils'
export default function ApplicationForm({ form, setForm, cvs, templates, editing, onClose, onSubmit }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const chooseTemplate = (id) => {
    const template = templates.find((item) => item.id === id)
    setForm((current) => ({ ...current, templateId: id, applicationText: template ? template.body : current.applicationText }))
  }
  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-card extended-form" onSubmit={onSubmit}>
    <div className="form-heading"><div><span className="eyebrow">{editing ? 'PÄIVITÄ HAKEMUS' : 'UUSI HAKEMUS'}</span><h2>{editing ? 'Muokkaa hakemusta' : 'Lisää hakemus'}</h2></div><button type="button" onClick={onClose} aria-label="Sulje">×</button></div>
    <label>Yritys<input autoFocus required maxLength="120" value={form.company} onChange={(event) => update('company', event.target.value)} placeholder="Esim. Yritys Oy" /></label>
    <label>Tehtävä<input required maxLength="160" value={form.role} onChange={(event) => update('role', event.target.value)} placeholder="Esim. Ohjelmistokehittäjä" /></label>
    <label>Sijainti <small>vapaaehtoinen</small><input maxLength="160" value={form.place} onChange={(event) => update('place', event.target.value)} placeholder="Kaupunki · hybridi / etätyö" /></label>
    <label>Alkuperäisen ilmoituksen linkki <small>vapaaehtoinen</small><input type="url" value={form.link} onChange={(event) => update('link', event.target.value)} placeholder="https://" /></label>
    <div className="form-pair"><label>Oma CV-kirjasto <small>valitse sopiva versio · ei pakollinen</small><select value={form.cvId} onChange={(event) => update('cvId', event.target.value)}><option value="">Ei valittua CV:tä</option>{cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.name} · {cv.title}</option>)}</select></label><label>Hakemuspohja <small>pohjasta kopioidaan muokattava teksti</small><select value={form.templateId} onChange={(event) => chooseTemplate(event.target.value)}><option value="">Ei pohjaa</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div>
    <label>Hakemusteksti <small>tämän hakemuksen oma, muokattava versio</small><textarea maxLength="12000" rows="6" value={form.applicationText} onChange={(event) => update('applicationText', event.target.value)} placeholder="Valitse pohja tai kirjoita hakemus tähän." /></label>
    <label>Hakemuksen vaihe<select value={form.status} onChange={(event) => update('status', event.target.value)}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className="form-pair"><label>Seuraava tehtävä<input maxLength="180" value={form.next} onChange={(event) => update('next', event.target.value)} placeholder="Esim. kysy hakemuksen tilannetta" /></label><label>Muistutuspäivä<input type="date" value={form.nextDate} onChange={(event) => update('nextDate', event.target.value)} /></label></div>
    <div className="form-actions"><button className="cancel" type="button" onClick={onClose}>Peruuta</button><button className="add-button" type="submit">{editing ? 'Tallenna muutokset →' : 'Tallenna hakemus →'}</button></div>
  </form></div>
}
