import './DashboardStats.css'
import { useMemo } from 'react'
import { responseTypes, sentTypes } from '../../utils'
function Metric({ label, value, foot, stamp }) { return <article className="metric"><div><span>{label}</span><i>{stamp}</i></div><b>{value}</b><small><i/> {foot}</small></article> }
export default function DashboardStats({ jobs, onOpenJob }) {
  const sent = jobs.filter((job) => job.events.some((event) => sentTypes.includes(event.type)))
  const responses = jobs.filter((job) => job.events.some((event) => responseTypes.includes(event.type)))
  const interviews = jobs.filter((job) => job.events.some((event) => event.type.toLowerCase().includes('haastattelu')) || job.status === 'Haastattelu')
  const durations = sent.map((job) => {
    const sentEvent = job.events.filter((event) => sentTypes.includes(event.type)).sort((a, b) => a.date.localeCompare(b.date))[0]
    const response = job.events.filter((event) => responseTypes.includes(event.type)).sort((a, b) => a.date.localeCompare(b.date))[0]
    return sentEvent && response ? Math.max(0, Math.round((new Date(response.date) - new Date(sentEvent.date)) / 86400000)) : null
  }).filter((value) => value !== null)
  const average = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null
  const monthData = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
    return { key, label: new Intl.DateTimeFormat('fi-FI', { month: 'short' }).format(date), sent: jobs.filter((job) => job.events.some((event) => sentTypes.includes(event.type) && event.date.startsWith(key))).length, responses: jobs.filter((job) => job.events.some((event) => responseTypes.includes(event.type) && event.date.startsWith(key))).length }
  }), [jobs])
  const max = Math.max(1, ...monthData.flatMap((month) => [month.sent, month.responses]))
  return <>
    <div className="metrics"><Metric label="Hakemuksia" value={jobs.length} foot="kaikkiaan muistissa" stamp="A" /><Metric label="Lähetetty" value={sent.length} foot="hakemusta lähetetty" stamp="↗" /><Metric label="Haastattelut" value={interviews.length} foot="haastatteluun edenneet" stamp="✳" /><Metric label="Haastatteluun" value={(sent.length ? Math.round(interviews.length / sent.length * 100) : 0) + '%'} foot="osuus lähetetyistä" stamp="%" /></div>
    <div className="dashboard-grid"><section className="paper chart-paper"><div className="section-heading"><div><h2>Hakemukset ja vastaukset</h2><p>Kuukausittaiset lähetykset ja vastaukset</p></div><span className="tag">VIIMEISET 6 KK</span></div><div className="live-chart">{monthData.map((month) => <div className="live-chart-group" key={month.key}><div className="live-bars"><i title={month.sent + ' lähetetty'} style={{ height: Math.max(4, month.sent / max * 100) + '%' }} /><i title={month.responses + ' vastausta'} style={{ height: Math.max(4, month.responses / max * 100) + '%' }} /></div><span>{month.label}</span><small>{month.sent}/{month.responses}</small></div>)}</div><div className="legend"><span><i/>Lähetetyt</span><span><i/>Vastaukset</span></div></section>
    <section className="paper next-paper"><div className="section-heading"><div><h2>Vastausaika</h2><p>Lähettämisestä ensimmäiseen vastaukseen</p></div><span className="sun">◷</span></div><div className="response-stat">{average === null ? '—' : average}<small>{average === null ? 'päivää · ei vastaustietoja' : 'päivää keskimäärin'}</small></div><p className="conversion-note">{responses.length} vastausta {sent.length} lähetetystä hakemuksesta</p><div className="upcoming-mini"><b>Seuraavaksi</b>{jobs.filter((job) => job.nextDate).sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 2).map((job) => <button key={job.id} onClick={() => onOpenJob(job)}><time>{job.nextDate}</time><span>{job.next || 'Muistutus'} · {job.company}</span></button>)}{!jobs.some((job) => job.nextDate) && <small>Lisää muistutuspäivä hakemuksen tietoihin.</small>}</div></section></div>
  </>
}
