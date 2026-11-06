import './ApplicationCard.css'
import { dateLabel } from '../../utils'
import { StatusPicker } from '../ApplicationRows/ApplicationRows'
export default function ApplicationCard({ job, onStatus, onEdit, onDelete, onDetails }) {
  return <article className="job-card"><div><span className={'company-icon ' + job.color}>{job.initial}</span><small>{dateLabel(job.added)}</small></div><b>{job.role}</b><span>{job.company}</span><label className="card-stage-label">HAKEMUKSEN VAIHE<StatusPicker job={job} onStatus={onStatus} /></label><footer>↳ {job.nextDate ? dateLabel(job.nextDate) + ' · ' : ''}{job.next || 'Ei seuraavaa tehtävää'}</footer><div className="card-actions"><button onClick={() => onDetails(job)}>Tiedot</button><button onClick={() => onEdit(job)}>Muokkaa</button><button className="delete-action" onClick={() => onDelete(job)}>Poista</button></div></article>
}
