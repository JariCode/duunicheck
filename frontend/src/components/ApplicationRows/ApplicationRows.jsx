import './ApplicationRows.css'
import { dateLabel, firstResponseDate, stages, tone } from '../../utils'
export function StatusPicker({ job, onStatus }) {
  return <select className={'status-picker ' + tone(job.status)} value={job.status} onChange={(event) => onStatus(job.id, event.target.value)} aria-label={'Vaihda hakemuksen ' + job.company + ' vaihe'}>{stages.map((item) => <option key={item}>{item}</option>)}</select>
}
export default function ApplicationRows({ jobs, onStatus, onEdit, onDelete, onDetails }) {
  return <div className="job-rows"><div className="rows-label"><span>YRITYS / TEHTÄVÄ</span><span>VAIHE</span><span>LÄHETETTY</span><span>VASTAUSPÄIVÄ</span><span>SEURAAVAKSI</span><span>TOIMINNOT</span></div>
    {jobs.length ? jobs.map((job) => <div className="job-row" key={job.id}>
      <button className="company company-button" onClick={() => onDetails(job)}><span className={'company-icon ' + job.color}>{job.initial}</span><span><b>{job.company}</b><small>{job.role}{job.place ? ' · ' + job.place : ''}</small></span></button>
      <span><StatusPicker job={job} onStatus={onStatus} /></span><span className="added">{dateLabel(job.added)}</span><span className="response-date">{(job.respondedAt || firstResponseDate(job.events)) ? dateLabel(job.respondedAt || firstResponseDate(job.events)) : 'Ei vielä'}</span>
      <span className="next-step">{job.nextDate ? dateLabel(job.nextDate) + ' · ' : ''}{job.next || '—'}<small className="mobile-response-date">Vastaus: {(job.respondedAt || firstResponseDate(job.events)) ? dateLabel(job.respondedAt || firstResponseDate(job.events)) : 'ei vielä'}</small></span>
      <span className="row-actions"><button onClick={() => onDetails(job)}>Tiedot</button><button onClick={() => onEdit(job)}>Muokkaa</button><button className="delete-action" onClick={() => onDelete(job)}>Poista</button></span>
    </div>) : <p className="empty">Ei osumia. Kokeile toista hakua.</p>}
  </div>
}
