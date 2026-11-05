import './ApplicationForm.css'
import { stages } from '../../utils'
import DateField from '../DateField/DateField'
export default function ApplicationForm({ form, setForm, cvs, templates, editing, onClose, onSubmit }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const chooseTemplate = (id) => {
    setForm((current) => ({ ...current, templateId: id }))
  }
  return <div className="overlay application-form-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-card extended-form" onSubmit={onSubmit}>
    <div className="form-heading"><div><span className="eyebrow">{editing ? 'PÄIVITÄ HAKEMUS' : 'UUSI HAKEMUS'}</span><h2>{editing ? 'Muokkaa hakemusta' : 'Lisää hakemus'}</h2></div><button type="button" onClick={onClose} aria-label="Sulje">×</button></div>
    <div className="form-pair"><label>Yritys<input autoFocus required maxLength="120" value={form.company} onChange={(event) => update('company', event.target.value)} placeholder="Esim. Yritys Oy" /></label><label>Tehtävä<input required maxLength="160" value={form.role} onChange={(event) => update('role', event.target.value)} placeholder="Esim. Ohjelmistokehittäjä" /></label></div>
    <div className="form-pair"><label>Sijainti <small>vapaaehtoinen</small><input maxLength="160" value={form.place} onChange={(event) => update('place', event.target.value)} placeholder="Kaupunki · hybridi / etätyö" /></label><label>Ilmoituksen linkki <small>vapaaehtoinen</small><input type="url" value={form.link} onChange={(event) => update('link', event.target.value)} placeholder="https://" /></label></div>
    <div className="form-pair"><label>Oma CV-kirjasto <small>valitse sopiva versio · ei pakollinen</small><select value={form.cvId} onChange={(event) => update('cvId', event.target.value)}><option value="">Ei valittua CV:tä</option>{cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.name} · {cv.title}</option>)}</select></label><label>Hakemuspohja <small>valinnainen pohja tälle hakemukselle</small><select value={form.templateId} onChange={(event) => chooseTemplate(event.target.value)}><option value="">Ei pohjaa</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div>
    <label>Muistiinpanot <small>tämän haun tärkeät huomiot, yhteyshenkilöt ja sovitut asiat</small><textarea maxLength="8000" rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Esim. rekrytoijan nimi, palkkatoive tai haastatteluun valmistautuminen." /></label>
    <div className="form-pair"><label>Lähetyspäivä<DateField value={form.added} onChange={(value) => update('added', value)} ariaLabel="Lähetyspäivä" /></label><label>Vastauspäivä<DateField value={form.respondedAt} onChange={(value) => update('respondedAt', value)} ariaLabel="Vastauspäivä" /></label></div>
    <label>Hakemuksen vaihe<select value={form.status} onChange={(event) => update('status', event.target.value)}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className="form-pair"><label>Seuraava tehtävä<input maxLength="180" value={form.next} onChange={(event) => update('next', event.target.value)} placeholder="Soita rekrytoijalle" /></label><label>Muistutuspäivä<DateField value={form.nextDate} onChange={(value) => update('nextDate', value)} ariaLabel="Muistutuspäivä" /></label></div>
    <div className="form-actions"><button className="cancel" type="button" onClick={onClose}>Peruuta</button><button className="add-button" type="submit">{editing ? 'Tallenna muutokset →' : 'Tallenna hakemus →'}</button></div>
  </form></div>
}
