import './BoardPage.css'
import { useRef } from 'react'
import { StatusPicker } from '../../components/ApplicationRows/ApplicationRows'
import { dateLabel, sentTypes, stages, today } from '../../utils'

const stageTone = (status) =>
  ({
    Kiinnostava: 'applications',
    Lähetetty: 'sent',
    'Haastattelu sovittu': 'interviews',
    Hyväksytty: 'accepted',
    Hylätty: 'rejected',
  })[status] || 'applications'

// Accepted and rejected applications end their timeline at the outcome date.
const terminalStatuses = ['Hyväksytty', 'Hylätty']

const dayValue = (value) => (value ? new Date(`${value}T12:00:00`).getTime() : null)

function timelineDates(job) {
  const eventDates = (job.events || []).map((event) => event.date).filter(Boolean)
  const sentDate = eventDates
    .filter((date) => (job.events || []).some((event) => sentTypes.includes(event.type) && event.date === date))
    .sort()[0]
  const start = dayValue(sentDate || job.added) ?? dayValue(today())
  const outcomeDate = (job.events || [])
    .filter((event) => ['Hylätty', 'Hyväksytty'].includes(event.type) && event.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1)?.date
  const dates = eventDates.map(dayValue).filter(Number.isFinite)
  if (job.nextDate && dayValue(job.nextDate)) dates.push(dayValue(job.nextDate))
  if (!terminalStatuses.includes(job.status)) dates.push(dayValue(today()))
  const terminalDate = outcomeDate || (terminalStatuses.includes(job.status) ? job.respondedAt : '')
  const end =
    terminalDate && dayValue(terminalDate) ? Math.max(start, dayValue(terminalDate)) : Math.max(start, ...dates)
  return { start, end, startDate: sentDate || job.added, terminalDate }
}

function timelineDateRange(start, end) {
  if (!start || !end) return ''
  const first = new Date(`${start}T12:00:00`)
  const last = new Date(`${end}T12:00:00`)
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime())) return ''
  const firstPart = `${first.getDate()}.${first.getMonth() + 1}`
  const lastPart = `${last.getDate()}.${last.getMonth() + 1}`
  return first.getFullYear() === last.getFullYear()
    ? `${firstPart}–${lastPart}.${last.getFullYear()}`
    : `${firstPart}.${first.getFullYear()}–${lastPart}.${last.getFullYear()}`
}

function eventTone(type, currentStatus) {
  if (sentTypes.includes(type)) return 'sent'
  if (type.toLowerCase().includes('haastattelu')) return 'interviews'
  if (type === 'Hylätty') return 'rejected'
  if (type === 'Hyväksytty') return 'accepted'
  return stageTone(currentStatus)
}

export default function BoardPage({ jobs, actions }) {
  const dragState = useRef(null)
  const rows = [...jobs]
    .sort((a, b) => (b.added || '').localeCompare(a.added || ''))
    .map((job) => ({ job, ...timelineDates(job) }))
  const allDates = rows.flatMap(({ start, end, job }) => [
    start,
    end,
    ...(job.events || []).map((event) => dayValue(event.date)).filter(Number.isFinite),
  ])
  const recordedDates = rows.flatMap(({ start, job }) => [
    start,
    ...(job.events || []).map((event) => dayValue(event.date)).filter(Number.isFinite),
  ])
  const now = dayValue(today())
  const firstDate = new Date(recordedDates.length ? Math.min(...recordedDates) : now)
  firstDate.setDate(1)
  const lastDate = new Date(Math.max(now, ...(allDates.length ? allDates : [now])))
  lastDate.setDate(1)
  lastDate.setMonth(lastDate.getMonth() + 2)
  const monthCount = Math.max(
    2,
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + lastDate.getMonth() - firstDate.getMonth(),
  )
  const axisStart = firstDate.getTime()
  const axisEnd = lastDate.getTime()
  const axisRange = Math.max(1, axisEnd - axisStart)
  const position = (value) => Math.max(0, Math.min(100, ((value - axisStart) / axisRange) * 100))
  const axisDays = Math.ceil(axisRange / 86400000)
  const width = Math.max(720, axisDays * 3.5)
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(firstDate.getFullYear(), firstDate.getMonth() + index, 1)
    return { date, position: position(date.getTime()) }
  })
  const weekTicks = []
  const firstTick = new Date(firstDate)
  firstTick.setDate(firstTick.getDate() + ((8 - firstTick.getDay()) % 7))
  for (const date = new Date(firstTick); date.getTime() < axisEnd; date.setDate(date.getDate() + 7)) {
    weekTicks.push({ date: new Date(date), labelPosition: position(date.getTime() + 3.5 * 86400000) })
  }

  const monthBoundaries = [...months, { date: lastDate, position: 100 }]

  return (
    <section className="timeline-page">
      <div className="timeline-summary">
        <span>{jobs.length} hakemusta aikajanalla</span>
        <div className="timeline-legend">
          {stages.map((stage) => (
            <span key={stage}>
              <i className={stageTone(stage)} />
              {stage}
            </span>
          ))}
        </div>
      </div>
      <div
        className="timeline-scroll"
        aria-label="Hakemusten aikajana"
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button,select,input,a'))
            return
          dragState.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            scrollLeft: event.currentTarget.scrollLeft,
            moved: false,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const drag = dragState.current
          if (!drag || drag.pointerId !== event.pointerId) return
          const distance = event.clientX - drag.startX
          if (Math.abs(distance) > 3) {
            drag.moved = true
            event.currentTarget.classList.add('is-dragging')
            event.preventDefault()
            event.currentTarget.scrollLeft = drag.scrollLeft - distance
          }
        }}
        onPointerUp={(event) => {
          dragState.current = null
          event.currentTarget.classList.remove('is-dragging')
        }}
        onPointerCancel={(event) => {
          dragState.current = null
          event.currentTarget.classList.remove('is-dragging')
        }}
      >
        <div className="timeline-grid" style={{ '--timeline-width': `${width}px` }}>
          <div className="timeline-head">
            <b>HAKEMUS</b>
            <div className="timeline-axis">
              {monthBoundaries.map(({ date, position: left }) => (
                <i
                  className="timeline-month-header-boundary"
                  key={`line-${date.getFullYear()}-${date.getMonth()}`}
                  style={{ left: `${left}%` }}
                />
              ))}
              {months.map(({ date, position: left }) => (
                <span
                  className="timeline-month-tick"
                  key={`${date.getFullYear()}-${date.getMonth()}`}
                  style={{ left: `${left}%` }}
                >
                  {new Intl.DateTimeFormat('fi-FI', { month: 'short', year: '2-digit' }).format(date)}
                </span>
              ))}
              {weekTicks.map(({ date, labelPosition }) => (
                <span className="timeline-day-tick" key={date.toISOString()} style={{ left: `${labelPosition}%` }}>
                  {date.getDate()}
                </span>
              ))}
            </div>
          </div>
          {rows.length ? (
            rows.map(({ job, start, end, startDate, terminalDate }) => {
              const statusColor = stageTone(job.status)
              const left = position(start)
              const right = position(Math.max(end, start + 86400000))
              const localRange = Math.max(86400000, end - start)
              const mobilePosition = (value) => Math.max(5, Math.min(95, 5 + ((value - start) / localRange) * 90))
              const events = (job.events || []).filter((event) => Number.isFinite(dayValue(event.date)))
              return (
                <article className="timeline-row" key={job.id}>
                  <div className="timeline-job">
                    <div className="timeline-job-title">
                      <span className={'company-icon ' + job.color}>{job.initial}</span>
                      <span>
                        <b>{job.company}</b>
                        <small>{job.role}</small>
                      </span>
                    </div>
                    <StatusPicker job={job} onStatus={actions.onStatus} />
                    <div className="timeline-actions">
                      <button onClick={() => actions.onDetails(job)}>Tiedot</button>
                      <button data-focus-key={`edit-application-${job.id}`} onClick={() => actions.onEdit(job)}>
                        Muokkaa
                      </button>
                      <button className="delete-action" onClick={() => actions.onDelete(job)}>
                        Poista
                      </button>
                    </div>
                  </div>
                  <div className="timeline-track">
                    {monthBoundaries.map(({ date, position: left }) => (
                      <span
                        className="timeline-month-boundary"
                        key={`${date.getFullYear()}-${date.getMonth()}`}
                        style={{ left: `${left}%` }}
                      />
                    ))}
                    <span
                      className={`timeline-line ${statusColor}`}
                      style={{ left: `${left}%`, width: `${Math.max(0.5, right - left)}%` }}
                    />
                    <span
                      className={`timeline-end ${statusColor}`}
                      style={{ left: `${right}%` }}
                      title={`Tila: ${job.status}`}
                    />
                    {events.map((event, index) => (
                      <span
                        className={`timeline-event ${eventTone(event.type, job.status)}`}
                        key={`${event.id || event.date}-${index}`}
                        style={{ left: `${position(dayValue(event.date))}%` }}
                        title={`${dateLabel(event.date)} · ${event.type}${event.note ? ` — ${event.note}` : ''}`}
                        aria-label={`${dateLabel(event.date)} ${event.type}`}
                      />
                    ))}
                    <time className="timeline-start-date" style={{ left: `${left}%` }}>
                      {terminalDate ? timelineDateRange(startDate, terminalDate) : dateLabel(startDate)}
                    </time>
                    {job.nextDate && (
                      <time className="timeline-next-date" style={{ left: `${position(dayValue(job.nextDate))}%` }}>
                        Seuraavaksi · {dateLabel(job.nextDate)}
                      </time>
                    )}
                  </div>
                  <div className="timeline-mobile">
                    <div className="timeline-mobile-rail">
                      <span className={`timeline-mobile-line ${statusColor}`} />
                      <span className={`timeline-mobile-point ${statusColor}`} style={{ left: '5%' }} />
                      <span className={`timeline-mobile-point ${statusColor}`} style={{ left: '95%' }} />
                      {events.map((event, index) => (
                        <span
                          className={`timeline-mobile-event ${eventTone(event.type, job.status)}`}
                          key={`${event.id || event.date}-${index}`}
                          style={{ left: `${mobilePosition(dayValue(event.date))}%` }}
                          title={`${dateLabel(event.date)} · ${event.type}${event.note ? ` — ${event.note}` : ''}`}
                        />
                      ))}
                    </div>
                    <div className="timeline-mobile-dates">
                      <span>
                        <small>Alkoi</small>
                        <time>{dateLabel(job.added)}</time>
                      </span>
                      <span>
                        <small>{job.nextDate ? 'Seuraavaksi' : 'Tila'}</small>
                        <time>{job.nextDate ? `${dateLabel(job.nextDate)} · ${job.next || ''}` : job.status}</time>
                      </span>
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <p className="timeline-empty">Lisää hakemus, niin sen eteneminen näkyy tällä aikajanalla.</p>
          )}
        </div>
      </div>
      <button className="timeline-add" data-focus-key="add-application" onClick={actions.onAdd}>
        ＋ Lisää hakemus
      </button>
    </section>
  )
}
