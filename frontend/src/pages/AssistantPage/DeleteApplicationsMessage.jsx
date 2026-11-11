import './ImportApplicationsMessage.css'

const shortDate = (value) => {
  const [year, month, day] = (value || '').split('-')
  return value ? `${Number(day)}.${Number(month)}.${year}` : '—'
}

// Search results for a delete request. Nothing is deleted here: the delete button only asks
// the page to open the confirmation dialog for the selected rows.
export default function DeleteApplicationsMessage({ message, onChange, onDelete, onClose }) {
  const { rows, deleting, done } = message
  const selectedCount = rows.filter((row) => row.selected && !row.deleted).length
  const setAll = (selected) => onChange({ rows: rows.map((row) => ({ ...row, selected: selected && !row.deleted })) })
  const setRow = (id, selected) => onChange({ rows: rows.map((row) => (row.id === id ? { ...row, selected } : row)) })
  return (
    <article className="assistant-message import-message">
      <b>Työpari · poistettavat hakemukset</b>
      {message.description.length > 0 && <p>Ymmärsin hakuehdot: {message.description.join(' · ')}</p>}
      <p>
        {message.needsDetail
          ? 'En löytänyt pyynnöstä yhtään selvää hakuehtoa, joten en hae kaikkia hakemuksia. Tarkenna, esimerkiksi tila, yritys tai päivämäärä.'
          : rows.length
            ? `Löysin ${rows.length} hakemusta. Valitse poistettavat. Mitään ei poisteta ennen vahvistustasi.`
            : 'Ehdoilla ei löytynyt yhtään hakemusta.'}
      </p>
      {rows.length > 0 && (
        <>
          {!done && (
            <div className="import-toolbar">
              <button type="button" className="import-link" disabled={deleting} onClick={() => setAll(true)}>
                Valitse kaikki
              </button>
              <button type="button" className="import-link" disabled={deleting} onClick={() => setAll(false)}>
                Poista valinnat
              </button>
            </div>
          )}
          <ul className="import-list">
            {rows.map((row) => (
              <li key={row.id} className={`import-row${row.deleted ? ' is-saved' : ''}`}>
                <label className="import-row-summary">
                  <input
                    type="checkbox"
                    checked={row.selected && !row.deleted}
                    disabled={deleting || done || row.deleted}
                    onChange={(event) => setRow(row.id, event.target.checked)}
                    aria-label={`Valitse ${row.company} ${row.role}`}
                  />
                  <span className="import-row-toggle delete-row-info">
                    <b>{row.company}</b>
                    <span>{row.role}</span>
                    <span>{row.status}</span>
                    <span>{shortDate(row.added)}</span>
                  </span>
                </label>
                {row.deleted && (
                  <div className="import-flags">
                    <span className="import-flag incomplete">Poistettu</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {message.error && (
        <span className="assistant-error" role="alert">
          {message.error}
        </span>
      )}
      {rows.length > 0 && !done && (
        <button type="button" className="add-button chat-send" disabled={deleting || !selectedCount} onClick={onDelete}>
          {deleting ? 'Poistetaan…' : `Poista valitut (${selectedCount})`}
        </button>
      )}
      {!deleting && (
        <button type="button" className="import-link message-close" onClick={onClose}>
          Sulje lista
        </button>
      )}
    </article>
  )
}
