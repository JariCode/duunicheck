import './DashboardStats.css'
import { useMemo } from 'react'
import { responseTypes, sentTypes } from '../../utils'
function Metric({ label, value, foot, stamp }) {
  return (
    <article className="metric">
      <div>
        <span>{label}</span>
        <i>{stamp}</i>
      </div>
      <b>{value}</b>
      <small>
        <i /> {foot}
      </small>
    </article>
  )
}
export default function DashboardStats({ jobs, onOpenJob }) {
  const getSentDate = (job) =>
    job.events.find((event) => sentTypes.includes(event.type))?.date || (job.status === 'Lähetetty' ? job.added : '')
  const hasInterview = (job) =>
    job.status === 'Haastattelu sovittu' || job.events.some((event) => event.type.toLowerCase().includes('haastattelu'))
  const getInterviewDate = (job) =>
    job.events.find((event) => event.type.toLowerCase().includes('haastattelu'))?.date ||
    (job.status === 'Haastattelu sovittu' ? job.respondedAt || job.added : '')
  const getRejectedDate = (job) =>
    job.events.find((event) => event.type === 'Hylätty')?.date ||
    (job.status === 'Hylätty' ? job.respondedAt || job.added : '')
  const isAccepted = (job) => job.status === 'Hyväksytty' || job.events.some((event) => event.type === 'Hyväksytty')
  const getAcceptedDate = (job) =>
    job.events.find((event) => event.type === 'Hyväksytty')?.date ||
    (job.status === 'Hyväksytty' ? job.respondedAt || job.added : '')
  const sent = jobs.filter((job) => job.status === 'Lähetetty')
  const allSent = jobs.filter((job) => Boolean(getSentDate(job)))
  const responses = jobs.filter((job) => job.events.some((event) => responseTypes.includes(event.type)))
  const interviews = jobs.filter(hasInterview)
  const accepted = jobs.filter(isAccepted)
  const rejected = jobs.filter(
    (job) => job.status === 'Hylätty' || job.events.some((event) => event.type === 'Hylätty'),
  )
  const durations = allSent
    .map((job) => {
      const sentEvent = job.events
        .filter((event) => sentTypes.includes(event.type))
        .sort((a, b) => a.date.localeCompare(b.date))[0]
      const response = job.events
        .filter((event) => responseTypes.includes(event.type))
        .sort((a, b) => a.date.localeCompare(b.date))[0]
      return sentEvent && response
        ? Math.max(0, Math.round((new Date(response.date) - new Date(sentEvent.date)) / 86400000))
        : null
    })
    .filter((value) => value !== null)
  const average = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null
  const monthData = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const date = new Date()
        date.setDate(1)
        date.setMonth(date.getMonth() - (5 - index))
        const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
        const inMonth = (value) => Boolean(value && value.startsWith(key))
        return {
          key,
          label: new Intl.DateTimeFormat('fi-FI', { month: 'short' }).format(date),
          applications: jobs.filter((job) => String(job.added || job.createdAt || '').startsWith(key)).length,
          sent: jobs.filter((job) => job.status === 'Lähetetty' && inMonth(getSentDate(job))).length,
          interviews: jobs.filter((job) => hasInterview(job) && inMonth(getInterviewDate(job))).length,
          accepted: jobs.filter((job) => isAccepted(job) && inMonth(getAcceptedDate(job))).length,
          rejected: jobs.filter(
            (job) =>
              (job.status === 'Hylätty' || job.events.some((event) => event.type === 'Hylätty')) &&
              inMonth(getRejectedDate(job)),
          ).length,
        }
      }),
    [jobs],
  )
  const max = Math.max(
    1,
    ...monthData.flatMap((month) => [month.applications, month.sent, month.interviews, month.accepted, month.rejected]),
  )
  return (
    <>
      <div className="metrics">
        <Metric label="Hakemuksia yhteensä" value={jobs.length} foot="kaikkiaan muistissa" stamp="A" />
        <Metric label="Lähetetty" value={sent.length} foot="odottaa vastausta" stamp="↗" />
        <Metric label="Haastattelut" value={interviews.length} foot="haastatteluun edenneet" stamp="✳" />
        <Metric label="Hyväksytyt" value={accepted.length} foot="työpaikka saatu" stamp="✓" />
        <Metric label="Hylätyt" value={rejected.length} foot="hakemusta hylätty" stamp="×" />
      </div>
      <div className="dashboard-grid">
        <section className="paper chart-paper">
          <div className="section-heading">
            <div>
              <h2>Hakemukset kuukausittain</h2>
              <p>Hakemukset, lähetetyt, haastattelut, hyväksytyt ja hylätyt</p>
            </div>
            <span className="tag">VIIMEISET 6 KK</span>
          </div>
          <div className="live-chart">
            {monthData.map((month) => (
              <div
                className="live-chart-group"
                key={month.key}
                title={`${month.label}: ${month.applications} hakemusta, ${month.sent} lähetetty, ${month.interviews} haastattelua, ${month.accepted} hyväksytty, ${month.rejected} hylätty`}
              >
                <div className="live-bars">
                  <i
                    className="bar-applications"
                    title={`${month.applications} hakemusta`}
                    style={{ height: Math.max(4, (month.applications / max) * 100) + '%' }}
                  />
                  <i
                    className="bar-sent"
                    title={`${month.sent} lähetetty`}
                    style={{ height: Math.max(4, (month.sent / max) * 100) + '%' }}
                  />
                  <i
                    className="bar-interviews"
                    title={`${month.interviews} haastattelua`}
                    style={{ height: Math.max(4, (month.interviews / max) * 100) + '%' }}
                  />
                  <i
                    className="bar-accepted"
                    title={`${month.accepted} hyväksytty`}
                    style={{ height: Math.max(4, (month.accepted / max) * 100) + '%' }}
                  />
                  <i
                    className="bar-rejected"
                    title={`${month.rejected} hylätty`}
                    style={{ height: Math.max(4, (month.rejected / max) * 100) + '%' }}
                  />
                </div>
                <span>{month.label}</span>
                <small title="Kuukauden aikana lisätyt hakemukset">{month.applications}</small>
              </div>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="legend-applications" />
              Hakemuksia
            </span>
            <span>
              <i className="legend-sent" />
              Lähetetty
            </span>
            <span>
              <i className="legend-interviews" />
              Haastattelut
            </span>
            <span>
              <i className="legend-accepted" />
              Hyväksytyt
            </span>
            <span>
              <i className="legend-rejected" />
              Hylätyt
            </span>
          </div>
        </section>
        <section className="paper next-paper">
          <div className="section-heading">
            <div>
              <h2>Vastausaika</h2>
              <p>Lähettämisestä ensimmäiseen vastaukseen</p>
            </div>
            <span className="sun">◷</span>
          </div>
          <div className="response-stat">
            {average === null ? '—' : average}
            <small>{average === null ? 'päivää · ei vastaustietoja' : 'päivää keskimäärin'}</small>
          </div>
          <p className="conversion-note">
            {responses.length} vastausta {allSent.length} lähetetystä hakemuksesta
          </p>
          <div className="upcoming-mini">
            <b>Seuraavaksi</b>
            {jobs
              .filter((job) => job.nextDate)
              .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
              .slice(0, 2)
              .map((job) => (
                <button key={job.id} onClick={() => onOpenJob(job)}>
                  <time>{job.nextDate}</time>
                  <span>
                    {job.next || 'Muistutus'} · {job.company}
                  </span>
                </button>
              ))}
            {!jobs.some((job) => job.nextDate) && <small>Lisää muistutuspäivä hakemuksen tietoihin.</small>}
          </div>
        </section>
      </div>
    </>
  )
}
