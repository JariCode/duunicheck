import './BoardPage.css'
import { StatusPicker } from '../../components/ApplicationRows/ApplicationRows'
import { dateLabel, sentTypes, stages, today } from '../../utils'

const stageTone = (status) => ({ Kiinnostava: 'applications', Lähetetty: 'sent', 'Haastattelu sovittu': 'interviews', Hylätty: 'rejected' }[status] || 'applications')

const dayValue = (value) => value ? new Date(`${value}T12:00:00`).getTime() : null

function timelineDates(job) {
  const eventDates = (job.events || []).map((event) => event.date).filter(Boolean)
  const sentDate = eventDates.filter((date) => (job.events || []).some((event) => sentTypes.includes(event.type) && event.date === date)).sort()[0]
  const start = dayValue(sentDate || job.added) ?? dayValue(today())
  const rejectDate = (job.events || []).filter((event) => event.type === 'Hylätty' && event.date).map((event) => dayValue(event.date)).sort((a, b) => a - b).at(-1)
  const dates = eventDates.map(dayValue).filter(Number.isFinite)
  if (job.nextDate && dayValue(job.nextDate)) dates.push(dayValue(job.nextDate))
  if (job.status !== 'Hylätty') dates.push(dayValue(today()))
  const end = job.status === 'Hylätty' ? (rejectDate || Math.max(start, ...dates)) : Math.max(start, ...dates)
  return { start, end }
}

function eventTone(type, currentStatus) {
  if (sentTypes.includes(type)) return 'sent'
  if (type.toLowerCase().includes('haastattelu')) return 'interviews'
  if (type === 'Hylätty') return 'rejected'
  return stageTone(currentStatus)
}

export default function BoardPage({ jobs, actions }) {
  const rows = jobs.map((job) => ({ job, ...timelineDates(job) }))
  const allDates = rows.flatMap(({ start, end, job }) => [start, end, ...(job.events || []).map((event) => dayValue(event.date)).filter(Number.isFinite)])
  const now = dayValue(today())
  const firstDate = new Date(Math.min(now, ...(allDates.length ? allDates : [now])))
  firstDate.setDate(1)
  firstDate.setMonth(firstDate.getMonth() - 1)
  const lastDate = new Date(Math.max(now, ...(allDates.length ? allDates : [now])))
  lastDate.setDate(1)
  lastDate.setMonth(lastDate.getMonth() + 2)
  const monthCount = Math.max(2, (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + lastDate.getMonth() - firstDate.getMonth())
  const axisStart = firstDate.getTime()
  const axisEnd = lastDate.getTime()
  const axisRange = Math.max(1, axisEnd - axisStart)
  const position = (value) => Math.max(0, Math.min(100, ((value - axisStart) / axisRange) * 100))
  const width = Math.max(720, monthCount * 120)
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(firstDate.getFullYear(), firstDate.getMonth() + index, 1)
    return { date, position: position(date.getTime()) }
  })

  return <section className="timeline-page">
    <div className="timeline-summary"><span>{jobs.length} hakemusta aikajanalla</span><div className="timeline-legend">{stages.map((stage) => <span key={stage}><i className={stageTone(stage)} />{stage}</span>)}</div></div>
    <div className="timeline-scroll" aria-label="Hakemusten aikajana">
      <div className="timeline-grid" style={{ '--timeline-width': `${width}px`, '--month-width': `${width / monthCount}px` }}>
        <div className="timeline-head"><b>HAKEMUS</b><div className="timeline-axis">{months.map(({ date, position: left }) => <span key={`${date.getFullYear()}-${date.getMonth()}`} style={{ left: `${left}%` }}>{new Intl.DateTimeFormat('fi-FI', { month: 'short', year: '2-digit' }).format(date)}</span>)}</div></div>
        {rows.length ? rows.map(({ job, start, end }) => {
          const statusColor = stageTone(job.status)
          const left = position(start)
          const right = position(Math.max(end, start + 86400000))
          const events = (job.events || []).filter((event) => event.date && dayValue(event.date) !== null)
          return <article className="timeline-row" key={job.id}>
            <div className="timeline-job">
              <div className="timeline-job-title"><span className={'company-icon ' + job.color}>{job.initial}</span><span><b>{job.company}</b><small>{job.role}</small></span></div>
              <StatusPicker job={job} onStatus={actions.onStatus} />
              <div className="timeline-actions"><button onClick={() => actions.onDetails(job)}>Tiedot</button><button onClick={() => actions.onEdit(job)}>Muokkaa</button><button className="delete-action" onClick={() => actions.onDelete(job)}>Poista</button></div>
            </div>
            <div className="timeline-track" style={{ backgroundSize: 'var(--month-width) 100%' }}>
              <span className={`timeline-line ${statusColor}`} style={{ left: `${left}%`, width: `${Math.max(0.5, right - left)}%` }} />
              <span className={`timeline-end ${statusColor}`} style={{ left: `${right}%` }} title={`Tila: ${job.status}`} />
              {events.map((event, index) => <span className={`timeline-event ${eventTone(event.type, job.status)}`} key={`${event.id || event.date}-${index}`} style={{ left: `${position(dayValue(event.date))}%` }} title={`${dateLabel(event.date)} · ${event.type}${event.note ? ` — ${event.note}` : ''}`} aria-label={`${dateLabel(event.date)} ${event.type}`} />)}
              <time className="timeline-start-date" style={{ left: `${left}%` }}>{dateLabel(job.added)}</time>
              {job.nextDate && <time className="timeline-next-date" style={{ left: `${position(dayValue(job.nextDate))}%` }}>Seuraavaksi · {dateLabel(job.nextDate)}</time>}
            </div>
          </article>
        }) : <p className="timeline-empty">Lisää hakemus, niin sen eteneminen näkyy tällä aikajanalla.</p>}
      </div>
    </div>
    <button className="timeline-add" onClick={actions.onAdd}>＋ Lisää hakemus</button>
  </section>
}
