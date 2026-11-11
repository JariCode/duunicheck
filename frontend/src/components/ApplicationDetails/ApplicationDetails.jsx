import './ApplicationDetails.css'
import { dateLabel, eventTypes, safeHttpUrl, today, tone } from '../../utils'
import { useState } from 'react'
import DateField from '../DateField/DateField'
import { useDialog } from '../../utils/useDialog.js'
export default function ApplicationDetails({
  job,
  cvs,
  templates = [],
  files = [],
  onDownloadFile,
  onClose,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAssistant,
  onPrint,
}) {
  const [event, setEvent] = useState({ type: '', date: today(), note: '' })
  const [eventError, setEventError] = useState('')
  const [eventBusy, setEventBusy] = useState(false)
  const [editingEventId, setEditingEventId] = useState(null)
  const [eventDraft, setEventDraft] = useState(null)
  const [deletingEventId, setDeletingEventId] = useState(null)
  // Escape first cancels an open event delete confirmation or event edit, then closes the dialog.
  const panelRef = useDialog({
    onClose,
    onEscape: () => {
      if (deletingEventId) {
        setDeletingEventId(null)
        return true
      }
      if (editingEventId) {
        setEditingEventId(null)
        setEventDraft(null)
        return true
      }
      return false
    },
  })
  const events = [...job.events].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const cv = cvs.find((item) => item.id === job.cvId)
  const template = templates.find((item) => item.id === job.templateId)
  const cvFile = files.find((item) => item.id === job.cvFileId)
  const applicationFiles = files.filter((item) => (job.applicationFileIds || []).includes(item.id))
  // Attachments whose CV, template or file has been deleted are shown as removed instead of hidden.
  const missingFileCount = (job.applicationFileIds || []).filter((id) => !files.some((item) => item.id === id)).length
  const missingAttachments = [
    job.cvId && !cv && 'CV on poistettu',
    job.cvFileId && !cvFile && 'CV-tiedosto on poistettu',
    job.templateId && !template && 'Hakemuspohja on poistettu',
    missingFileCount === 1 && 'Tiedosto on poistettu',
    missingFileCount > 1 && `${missingFileCount} tiedostoa on poistettu`,
  ].filter(Boolean)
  const printCv = () => cv && onPrint({ kind: 'cv', title: cv.name, cv })
  const printLetter = () =>
    template &&
    onPrint({
      kind: 'application',
      job: { company: job.company, role: job.role, place: job.place },
      cv: cv
        ? {
            ...cv,
            fullName: template.fullName || cv.fullName,
            email: template.email || cv.email,
            phone: template.phone || cv.phone,
            linkedin: template.linkedin || cv.linkedin,
            github: template.github || cv.github,
            portfolio: template.portfolio || cv.portfolio,
            website: template.website || cv.website,
          }
        : template,
      body: template.body,
    })
  const printApplication = () =>
    onPrint({
      kind: 'application',
      job: { company: job.company, role: job.role, place: job.place },
      cv: cv
        ? {
            ...cv,
            fullName: template?.fullName || cv.fullName,
            email: template?.email || cv.email,
            phone: template?.phone || cv.phone,
            linkedin: template?.linkedin || cv.linkedin,
            github: template?.github || cv.github,
            portfolio: template?.portfolio || cv.portfolio,
            website: template?.website || cv.website,
          }
        : template || {},
      body: template?.body || '',
    })
  async function addEvent(e) {
    e.preventDefault()
    if (!event.type || eventBusy) return
    setEventBusy(true)
    setEventError('')
    const result = await onAddEvent(job, event)
    if (result?.ok) setEvent({ type: '', date: today(), note: '' })
    else setEventError(result?.error || 'Tapahtuman tallennus epäonnistui. Yritä uudelleen.')
    setEventBusy(false)
  }
  async function saveEvent(item) {
    if (!eventDraft || eventBusy) return
    setEventBusy(true)
    setEventError('')
    const result = await onUpdateEvent(job, item.id, eventDraft)
    if (result?.ok) {
      setEditingEventId(null)
      setEventDraft(null)
    } else setEventError(result?.error || 'Tapahtuman tallennus epäonnistui. Yritä uudelleen.')
    setEventBusy(false)
  }
  async function deleteEvent(item) {
    if (eventBusy) return
    setEventBusy(true)
    setEventError('')
    const result = await onDeleteEvent(job, item.id)
    if (result?.ok) setDeletingEventId(null)
    else setEventError(result?.error || 'Tapahtuman poisto epäonnistui. Yritä uudelleen.')
    setEventBusy(false)
  }
  return (
    <div
      className="overlay detail-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        ref={panelRef}
        className="form-card detail-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-details-title"
        tabIndex="-1"
      >
        <div className="form-heading">
          <div>
            <span className="eyebrow">HAKEMUKSEN TIEDOT</span>
            <h2 id="application-details-title">{job.company}</h2>
            <p>
              {job.role}
              {job.place ? ' · ' + job.place : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Sulje">
            ×
          </button>
        </div>
        <div className="detail-actions">
          <span className={'detail-status ' + tone(job.status)}>{job.status}</span>
          {job.link && safeHttpUrl(job.link) && (
            <a href={safeHttpUrl(job.link)} target="_blank" rel="noopener noreferrer">
              Avaa työpaikkailmoitus ↗
            </a>
          )}
          {cv && (
            <button type="button" className="detail-document" onClick={printCv}>
              Tulosta sovelluksen CV: {cv.name}
            </button>
          )}
          {cvFile && (
            <button type="button" className="detail-document" onClick={() => onDownloadFile(cvFile)}>
              Lataa CV-tiedosto: {cvFile.name}
            </button>
          )}
          {template && (
            <button type="button" className="detail-document" onClick={printLetter}>
              Tulosta hakukirje: {template.name}
            </button>
          )}
          {applicationFiles.map((file) => (
            <button type="button" className="detail-document" key={file.id} onClick={() => onDownloadFile(file)}>
              Lataa hakukirje: {file.name}
            </button>
          ))}
          {missingAttachments.map((label) => (
            <span className="detail-document detail-missing" key={label}>
              {label}
            </span>
          ))}
        </div>
        <div className="detail-print-actions">
          <button onClick={printApplication}>Tulosta hakemus / PDF</button>
          <button
            onClick={() =>
              onPrint({
                title: 'Muistiinpanot · ' + job.company,
                blocks: [{ title: job.role, body: job.notes || 'Muistiinpanoja ei ole vielä lisätty.' }],
              })
            }
          >
            Tulosta muistiinpanot / PDF
          </button>
          <button onClick={() => onAssistant(job)}>Avaa AI-chat tällä hakemuksella</button>
        </div>
        {job.notes && (
          <section className="detail-copy">
            <h3>Muistiinpanot</h3>
            <p>{job.notes}</p>
          </section>
        )}
        <section className="history">
          <div className="section-heading">
            <div>
              <h3>Tapahtumahistoria</h3>
              <p>Tallenna jokainen työnhaun käänne päivämäärineen.</p>
            </div>
          </div>
          {events.length ? (
            <ol>
              {events.map((item) => (
                <li key={item.id}>
                  <time>{dateLabel(item.date)}</time>
                  <span className="history-event-content">
                    {editingEventId === item.id ? (
                      <>
                        <select
                          value={eventDraft.type}
                          onChange={(e) => setEventDraft({ ...eventDraft, type: e.target.value })}
                        >
                          {eventTypes.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                        <DateField
                          required
                          value={eventDraft.date}
                          onChange={(value) => setEventDraft({ ...eventDraft, date: value })}
                          ariaLabel="Tapahtuman päivämäärä"
                        />
                        <input
                          maxLength="300"
                          value={eventDraft.note}
                          onChange={(e) => setEventDraft({ ...eventDraft, note: e.target.value })}
                          aria-label="Tapahtuman lisätieto"
                        />
                        <div className="history-event-actions">
                          <button type="button" onClick={() => void saveEvent(item)} disabled={eventBusy}>
                            Tallenna
                          </button>
                          <button
                            type="button"
                            className="cancel"
                            onClick={() => {
                              setEditingEventId(null)
                              setEventDraft(null)
                            }}
                          >
                            Peruuta
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <b>{item.type}</b>
                        {item.note && <small>{item.note}</small>}
                        <div className="history-event-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEventId(item.id)
                              setEventDraft({ type: item.type, date: item.date, note: item.note || '' })
                              setDeletingEventId(null)
                              setEventError('')
                            }}
                          >
                            Muokkaa
                          </button>
                          <button
                            type="button"
                            className="delete-action"
                            onClick={() => {
                              setDeletingEventId(item.id)
                              setEditingEventId(null)
                              setEventError('')
                            }}
                          >
                            Poista
                          </button>
                        </div>
                        {deletingEventId === item.id && (
                          <div className="event-delete-confirm">
                            <span>Poistetaanko tämä merkintä?</span>
                            <button
                              type="button"
                              className="delete-action"
                              onClick={() => void deleteEvent(item)}
                              disabled={eventBusy}
                            >
                              Poista merkintä
                            </button>
                            <button type="button" className="cancel" onClick={() => setDeletingEventId(null)}>
                              Peruuta
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">Historiaa ei ole vielä lisätty.</p>
          )}
        </section>
        <form className="event-form" onSubmit={addEvent}>
          <h3>Lisää tapahtuma</h3>
          <div className="form-pair">
            <label>
              Tapahtuma
              <select required value={event.type} onChange={(e) => setEvent({ ...event, type: e.target.value })}>
                <option value="">Valitse tapahtuma</option>
                {eventTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Päivämäärä
              <DateField
                required
                value={event.date}
                onChange={(value) => setEvent({ ...event, date: value })}
                ariaLabel="Tapahtuman päivämäärä"
              />
            </label>
          </div>
          <label>
            Lisätieto <small>vapaaehtoinen</small>
            <input
              maxLength="300"
              value={event.note}
              onChange={(e) => setEvent({ ...event, note: e.target.value })}
              placeholder="Esim. haastattelu sovittu rekrytoijan kanssa"
            />
          </label>
          {eventError && (
            <p className="event-error" role="alert">
              {eventError}
            </p>
          )}
          <button className="add-button" type="submit" disabled={!event.type || eventBusy}>
            {eventBusy ? 'Tallennetaan…' : 'Lisää tapahtuma'}
          </button>
        </form>
        <div className="form-actions">
          <button className="cancel" onClick={onClose}>
            Sulje
          </button>
        </div>
      </section>
    </div>
  )
}
