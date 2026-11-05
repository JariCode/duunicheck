import './ApplicationDetails.css'
import { dateLabel, safeHttpUrl, today, tone } from '../../utils'
import { useState } from 'react'
import DateField from '../DateField/DateField'
export default function ApplicationDetails({ job, cvs, onClose, onAddEvent, onAssistant, onPrint }) {
  const [event, setEvent] = useState({ type: 'Vastaus saatu', date: today(), note: '' })
  const events = [...job.events].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const cv = cvs.find((item) => item.id === job.cvId)
  const addEvent = (e) => { e.preventDefault(); onAddEvent(job, event); setEvent({ type: 'Vastaus saatu', date: today(), note: '' }) }
  return <div className="overlay detail-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="form-card detail-card">
    <div className="form-heading"><div><span className="eyebrow">HAKEMUKSEN TIEDOT</span><h2>{job.company}</h2><p>{job.role}{job.place ? ' · ' + job.place : ''}</p></div><button type="button" onClick={onClose} aria-label="Sulje">×</button></div>
    <div className="detail-actions"><span className={'detail-status ' + tone(job.status)}>{job.status}</span>{job.link && safeHttpUrl(job.link) && <a href={safeHttpUrl(job.link)} target="_blank" rel="noopener noreferrer">Avaa työpaikkailmoitus ↗</a>}{cv && <span className="detail-document">Valittu CV: {cv.name}</span>}</div>
    <div className="detail-print-actions"><button onClick={() => onPrint({ title: 'Muistiinpanot · ' + job.company, blocks: [{ title: job.role, body: job.notes || 'Muistiinpanoja ei ole vielä lisätty.' }] })}>Tulosta muistiinpanot / PDF</button><button onClick={() => onAssistant(job)}>Avaa AI-chat tällä hakemuksella</button></div>
    {job.notes && <section className="detail-copy"><h3>Muistiinpanot</h3><p>{job.notes}</p></section>}
    <section className="history"><div className="section-heading"><div><h3>Tapahtumahistoria</h3><p>Tallenna jokainen työnhaun käänne päivämäärineen.</p></div></div>{events.length ? <ol>{events.map((item) => <li key={item.id}><time>{dateLabel(item.date)}</time><span><b>{item.type}</b>{item.note && <small>{item.note}</small>}</span></li>)}</ol> : <p className="empty">Historiaa ei ole vielä lisätty.</p>}</section>
    <form className="event-form" onSubmit={addEvent}><h3>Lisää tapahtuma</h3><div className="form-pair"><label>Tapahtuma<select value={event.type} onChange={(e) => setEvent({ ...event, type: e.target.value })}>{['Hakemus jätetty', 'Lähetetty', 'Vastaus saatu', 'Haastattelu sovittu', 'Haastattelu pidetty', 'Tarjous', 'Hylätty', 'Muu tapahtuma'].map((type) => <option key={type}>{type}</option>)}</select></label><label>Päivämäärä<DateField required value={event.date} onChange={(value) => setEvent({ ...event, date: value })} ariaLabel="Tapahtuman päivämäärä" /></label></div><label>Lisätieto <small>vapaaehtoinen</small><input maxLength="300" value={event.note} onChange={(e) => setEvent({ ...event, note: e.target.value })} placeholder="Esim. haastattelu sovittu rekrytoijan kanssa" /></label><button className="add-button" type="submit">Lisää tapahtuma</button></form>
    <div className="form-actions"><button className="cancel" onClick={onClose}>Sulje</button></div>
  </section></div>
}
