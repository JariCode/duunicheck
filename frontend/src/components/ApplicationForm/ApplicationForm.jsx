import './ApplicationForm.css'
import { stages } from '../../utils'
import DateField from '../DateField/DateField'
import { useState } from 'react'
import { useDialog } from '../../utils/useDialog.js'
import { isCoarsePointer } from '../../utils/pointer.js'

export default function ApplicationForm({ form, setForm, cvs, templates, files = [], editing, onClose, onSubmit }) {
  // On touch devices the dialog itself gets focus, so the keyboard does not open as soon as the form opens.
  const [touch] = useState(isCoarsePointer)
  // Escape works like the dialog's own close button.
  const panelRef = useDialog({ onClose, initialFocus: touch ? 'panel' : 'first' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const chooseCv = (value) =>
    setForm((current) => ({
      ...current,
      cvId: value.startsWith('cv:') ? value.slice(3) : '',
      cvFileId: value.startsWith('file:') ? value.slice(5) : '',
    }))
  const chooseLetter = (value) =>
    setForm((current) => ({
      ...current,
      templateId: value.startsWith('template:') ? value.slice(9) : '',
      applicationFileIds: value.startsWith('file:') ? [value.slice(5)] : [],
    }))
  const selectedCv = form.cvId ? `cv:${form.cvId}` : form.cvFileId ? `file:${form.cvFileId}` : ''
  const selectedLetter = form.templateId
    ? `template:${form.templateId}`
    : form.applicationFileIds?.[0]
      ? `file:${form.applicationFileIds[0]}`
      : ''
  return (
    <div
      className="overlay application-form-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        ref={panelRef}
        className="form-card extended-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-form-title"
        tabIndex="-1"
        onSubmit={onSubmit}
      >
        <div className="form-heading">
          <div>
            <span className="eyebrow">{editing ? 'PÄIVITÄ HAKEMUS' : 'UUSI HAKEMUS'}</span>
            <h2 id="application-form-title">{editing ? 'Muokkaa hakemusta' : 'Lisää hakemus'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Sulje">
            ×
          </button>
        </div>
        <div className="form-pair">
          <label>
            Yritys
            <input
              autoFocus={!touch}
              required
              maxLength="120"
              value={form.company}
              onChange={(event) => update('company', event.target.value)}
              placeholder="Esim. Yritys Oy"
            />
          </label>
          <label>
            Tehtävä
            <input
              required
              maxLength="160"
              value={form.role}
              onChange={(event) => update('role', event.target.value)}
              placeholder="Esim. Ohjelmistokehittäjä"
            />
          </label>
        </div>
        <div className="form-pair">
          <label>
            Sijainti <small>vapaaehtoinen</small>
            <input
              maxLength="160"
              value={form.place}
              onChange={(event) => update('place', event.target.value)}
              placeholder="Kaupunki · hybridi / etätyö"
            />
          </label>
          <label>
            Ilmoituksen linkki <small>vapaaehtoinen</small>
            <input
              type="url"
              value={form.link}
              onChange={(event) => update('link', event.target.value)}
              placeholder="https://"
            />
          </label>
        </div>
        <div className="form-pair">
          <label>
            CV liitteeksi <small>valitse sovelluksessa tehty CV tai ladattu tiedosto</small>
            <select value={selectedCv} onChange={(event) => chooseCv(event.target.value)}>
              <option value="">Ei CV-liitettä</option>
              {cvs.length > 0 && (
                <optgroup label="Omat CV-versiot">
                  {cvs.map((cv) => (
                    <option key={cv.id} value={`cv:${cv.id}`}>
                      {cv.name}
                      {cv.title ? ` · ${cv.title}` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {files.some((file) => file.category === 'cv') && (
                <optgroup label="Ladatut CV-tiedostot">
                  {files
                    .filter((file) => file.category === 'cv')
                    .map((file) => (
                      <option key={file.id} value={`file:${file.id}`}>
                        {file.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>
          <label>
            Hakukirje liitteeksi <small>valitse sovelluksen pohja tai ladattu tiedosto</small>
            <select value={selectedLetter} onChange={(event) => chooseLetter(event.target.value)}>
              <option value="">Ei hakukirje-liitettä</option>
              {templates.length > 0 && (
                <optgroup label="Omat hakemuspohjat">
                  {templates.map((template) => (
                    <option key={template.id} value={`template:${template.id}`}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {files.some((file) => file.category === 'application') && (
                <optgroup label="Ladatut hakukirjeet">
                  {files
                    .filter((file) => file.category === 'application')
                    .map((file) => (
                      <option key={file.id} value={`file:${file.id}`}>
                        {file.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>
        </div>
        <label>
          Muistiinpanot <small>tämän haun tärkeät huomiot, yhteyshenkilöt ja sovitut asiat</small>
          <textarea
            maxLength="8000"
            rows="3"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Esim. rekrytoijan nimi, palkkatoive tai haastatteluun valmistautuminen."
          />
        </label>
        <div className="form-pair">
          <label>
            Lähetyspäivä
            <DateField value={form.added} onChange={(value) => update('added', value)} ariaLabel="Lähetyspäivä" />
          </label>
          <label>
            Vastauspäivä
            <DateField
              value={form.respondedAt}
              onChange={(value) => update('respondedAt', value)}
              ariaLabel="Vastauspäivä"
            />
          </label>
        </div>
        <label>
          Hakemuksen vaihe
          <select value={form.status} onChange={(event) => update('status', event.target.value)}>
            {stages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="form-pair">
          <label>
            Seuraava tehtävä
            <input
              maxLength="180"
              value={form.next}
              onChange={(event) => update('next', event.target.value)}
              placeholder="Soita rekrytoijalle"
            />
          </label>
          <label>
            Muistutuspäivä
            <DateField
              value={form.nextDate}
              onChange={(value) => update('nextDate', value)}
              ariaLabel="Muistutuspäivä"
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="cancel" type="button" onClick={onClose}>
            Peruuta
          </button>
          <button className="add-button" type="submit">
            {editing ? 'Tallenna muutokset →' : 'Tallenna hakemus →'}
          </button>
        </div>
      </form>
    </div>
  )
}
