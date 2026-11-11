import './ImportApplicationsMessage.css'
import { eventTypes, stages } from '../../utils'
import { findExisting, rowSavable } from './importRows'

// Dates are shown in the Finnish d.m.yyyy form.
const shortDate = (value) => {
  const [year, month, day] = (value || '').split('-')
  return value ? `${Number(day)}.${Number(month)}.${year}` : '—'
}

const columnTargets = [
  ['ignore', 'Ei siirretä'],
  ['company', 'Yritys'],
  ['role', 'Tehtävä'],
  ['place', 'Paikkakunta'],
  ['link', 'Linkki'],
  ['status', 'Tila'],
  ['added', 'Lähetyspäivä'],
  ['respondedAt', 'Vastauspäivä'],
  ['interviewDate', 'Haastattelupäivä'],
  ['next', 'Seuraava tehtävä'],
  ['nextDate', 'Muistutuspäivä'],
  ['responded', 'Vastattu (kyllä/ei)'],
  ['notes', 'Muistiinpanot'],
]

function ImportRow({ row, jobs, disabled, onChange }) {
  const { fields } = row
  const savable = rowSavable(row)
  const setFields = (patch) => {
    const next = { ...fields, ...patch }
    const identityChanged = ['company', 'role', 'link'].some((key) => key in patch)
    const updated = {
      ...row,
      fields: next,
      incomplete: !next.company.trim() || !next.role.trim(),
      ...(identityChanged ? { duplicate: findExisting(next, jobs) } : {}),
    }
    onChange({ ...updated, selected: updated.selected && rowSavable(updated) })
  }
  const field = (name) => ({ value: fields[name], onChange: (event) => setFields({ [name]: event.target.value }) })
  const setEvent = (index, patch) =>
    setFields({ events: fields.events.map((event, position) => (position === index ? { ...event, ...patch } : event)) })
  const flags = [
    row.undone && ['incomplete', 'Tuonti kumottu'],
    row.saved && !row.undone && ['saved', 'Tallennettu'],
    !row.saved && row.duplicate && ['duplicate', row.duplicate.inFile ? 'Toistuu tiedostossa' : 'Duplikaatti'],
    !row.saved && row.incomplete && ['incomplete', 'Puutteellinen'],
    !row.saved && !row.incomplete && row.review && ['review', 'Tarkistettava'],
  ].filter(Boolean)
  return (
    <li className={`import-row${row.saved ? ' is-saved' : ''}`}>
      <div className="import-row-summary">
        <input
          type="checkbox"
          checked={row.selected}
          disabled={disabled || !savable}
          onChange={(event) => onChange({ ...row, selected: event.target.checked })}
          aria-label={`Valitse ${fields.company || 'rivi'} ${fields.role}`}
        />
        <button
          type="button"
          className="import-row-toggle"
          aria-expanded={row.open}
          disabled={row.saved}
          onClick={() => onChange({ ...row, open: !row.open })}
        >
          <b>{fields.company || 'Yritys puuttuu'}</b>
          <span>{fields.role || 'Tehtävä puuttuu'}</span>
          <span>{fields.status || 'Tila puuttuu'}</span>
          <span>{shortDate(fields.added)}</span>
        </button>
      </div>
      {flags.length > 0 && (
        <div className="import-flags">
          {flags.map(([kind, label]) => (
            <span key={kind} className={`import-flag ${kind}`}>
              {label}
            </span>
          ))}
          {row.duplicate && !row.saved && (
            <small>
              Sinulla on jo: {row.duplicate.company} · {row.duplicate.role}
            </small>
          )}
        </div>
      )}
      {row.open && !row.saved && (
        <fieldset className="import-row-editor" disabled={disabled}>
          {row.issues.length > 0 && (
            <ul className="import-issues">
              {row.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <label>
            Yritys
            <input maxLength="160" required {...field('company')} />
          </label>
          <label>
            Tehtävä
            <input maxLength="160" required {...field('role')} />
          </label>
          <label>
            Paikkakunta
            <input maxLength="160" {...field('place')} />
          </label>
          <label>
            Linkki
            <input type="url" inputMode="url" maxLength="2048" placeholder="https://…" {...field('link')} />
          </label>
          <label>
            Tila
            <select {...field('status')}>
              <option value="">Valitse tila</option>
              {stages.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
          </label>
          <label>
            Lähetyspäivä
            <input type="date" {...field('added')} />
          </label>
          <label>
            Vastauspäivä
            <input type="date" {...field('respondedAt')} />
          </label>
          <label>
            Seuraava tehtävä
            <input maxLength="200" {...field('next')} />
          </label>
          <label>
            Muistutuspäivä
            <input type="date" {...field('nextDate')} />
          </label>
          <label>
            Muistiinpanot
            <textarea rows="2" maxLength="8000" {...field('notes')} />
          </label>
          <label>
            Hakemusteksti
            <textarea rows="2" maxLength="20000" {...field('applicationText')} />
          </label>
          <div className="import-events">
            <span>Tapahtumat</span>
            {fields.events.map((event, index) => (
              <div className="import-event" key={event.id ?? index}>
                <select
                  value={event.type}
                  onChange={(change) => setEvent(index, { type: change.target.value })}
                  aria-label="Tapahtuma"
                >
                  {!eventTypes.includes(event.type) && <option>{event.type}</option>}
                  {eventTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={event.date}
                  onChange={(change) => setEvent(index, { date: change.target.value })}
                  aria-label="Tapahtuman päivämäärä"
                />
                <input
                  maxLength="2000"
                  value={event.note}
                  onChange={(change) => setEvent(index, { note: change.target.value })}
                  aria-label="Tapahtuman lisätieto"
                  placeholder="Lisätieto"
                />
                <button
                  type="button"
                  onClick={() => setFields({ events: fields.events.filter((_, position) => position !== index) })}
                  aria-label="Poista tapahtuma"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="import-link"
              onClick={() =>
                setFields({
                  events: [
                    ...fields.events,
                    { id: Date.now() + Math.random(), type: 'Muu tapahtuma', date: '', note: '' },
                  ],
                })
              }
            >
              ＋ Lisää tapahtuma
            </button>
          </div>
          {!savable && (
            <small className="import-hint">
              Täytä yritys, tehtävä ja tila sekä korjaa virheelliset päivämäärät tai linkki ennen tallennusta.
            </small>
          )}
        </fieldset>
      )}
    </li>
  )
}

export default function ImportApplicationsMessage({ message, jobs, onChange, onRemap, onSave, onUndo, onClose }) {
  const { rows, table, saving, remapping } = message
  const busy = saving || remapping || message.undoing
  const selectedCount = rows.filter((row) => row.selected && rowSavable(row)).length
  const setRow = (key, next) => onChange({ rows: rows.map((row) => (row.key === key ? next : row)) })
  const setAll = (selected) =>
    onChange({ rows: rows.map((row) => ({ ...row, selected: selected && rowSavable(row) })) })
  const multipleSheets = table?.sheets.length > 1
  return (
    <article className="assistant-message import-message">
      <b>Työpari · hakemukset tiedostosta</b>
      <p>
        {rows.length
          ? `Löysin tiedostosta ${message.fileName} ${rows.length} hakemusta. Tarkista valinnat ennen tallennusta: mitään ei tallenneta ennen kuin painat Tallenna valitut.`
          : `Tiedostosta ${message.fileName} ei löytynyt hakemuksia.`}
      </p>
      {message.notices.map((notice) => (
        <small className="import-notice" key={notice}>
          {notice}
        </small>
      ))}
      {table && (
        <details className="import-mapping" open>
          <summary>Sarakkeiden vastaavuus</summary>
          <div className="import-mapping-grid">
            {table.sheets.flatMap((sheet, sheetIndex) =>
              sheet.columns.map((column, columnIndex) => {
                const key = `${sheetIndex}:${columnIndex}`
                return (
                  <label key={key}>
                    <span>
                      {multipleSheets ? `${sheet.name} · ` : ''}
                      {column.label}
                    </span>
                    <select
                      value={table.mapping[key] || 'ignore'}
                      disabled={busy}
                      onChange={(event) => onRemap({ ...table.mapping, [key]: event.target.value })}
                      aria-label={`Sarakkeen ${column.label} kenttä`}
                    >
                      {columnTargets.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              }),
            )}
          </div>
          {remapping && <small>Päivitetään listaa…</small>}
        </details>
      )}
      {rows.length > 0 && (
        <>
          <div className="import-toolbar">
            <button type="button" className="import-link" disabled={busy} onClick={() => setAll(true)}>
              Valitse kaikki
            </button>
            <button type="button" className="import-link" disabled={busy} onClick={() => setAll(false)}>
              Poista valinnat
            </button>
          </div>
          <ul className="import-list">
            {rows.map((row) => (
              <ImportRow
                key={row.key}
                row={row}
                jobs={jobs}
                disabled={busy}
                onChange={(next) => setRow(row.key, next)}
              />
            ))}
          </ul>
        </>
      )}
      {message.error && (
        <span className="assistant-error" role="alert">
          {message.error}
        </span>
      )}
      {rows.length > 0 && (
        <button type="button" className="add-button chat-send" disabled={busy || !selectedCount} onClick={onSave}>
          {saving ? 'Tallennetaan…' : `Tallenna valitut (${selectedCount})`}
        </button>
      )}
      {message.createdIds?.length > 0 && (
        <div className="import-undo">
          <button type="button" className="import-undo-button" disabled={busy} onClick={onUndo}>
            Kumoa tuonti
          </button>
          <small>Kumoaminen on mahdollista, kunnes sivu ladataan uudelleen.</small>
        </div>
      )}
      {!busy && (
        <button type="button" className="import-link message-close" onClick={onClose}>
          Sulje lista
        </button>
      )}
    </article>
  )
}
