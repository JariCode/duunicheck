import './CalendarPage.css'
import { useMemo, useState } from 'react'
import { dateLabel, today } from '../../utils'
export default function CalendarPage({ jobs, onDetails }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const slots = Math.ceil((offset + count) / 7) * 7
  const keyFor = (day) => month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')
  const reminders = useMemo(() => jobs.filter((job) => job.nextDate).sort((a, b) => a.nextDate.localeCompare(b.nextDate)), [jobs])
  return <div className="calendar-layout"><section className="paper calendar-paper"><div className="section-heading"><div><h2>{new Intl.DateTimeFormat('fi-FI', { month: 'long', year: 'numeric' }).format(month)}</h2><p>Hakemuksiin liittyvät seuraavat askeleet</p></div><div className="calendar-controls"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Edellinen kuukausi">‹</button><button onClick={() => setMonth(new Date())}>Tänään</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Seuraava kuukausi">›</button></div></div>
    <div className="calendar-grid">{['MA','TI','KE','TO','PE','LA','SU'].map((day) => <b key={day}>{day}</b>)}{Array.from({ length: slots }, (_, index) => { const day = index - offset + 1; const inMonth = day > 0 && day <= count; const date = inMonth ? keyFor(day) : ''; const dayJobs = reminders.filter((job) => job.nextDate === date); return <div key={index} className={'day ' + (!inMonth ? 'dim ' : '') + (date === today() ? 'today' : '')}><span>{inMonth ? day : ''}</span>{dayJobs.map((job) => <button className="calendar-event" key={job.id} onClick={() => onDetails(job)} title={`${job.next || 'Muistutus'} · ${job.company} · ${job.role}`}><strong>{job.next || 'Muistutus'}</strong><small>{job.company}</small></button>)}</div> })}</div>
  </section><aside className="paper upcoming"><h2>Muistutukset</h2><p>Hakemuksista poimitut seuraavat askeleet</p>{reminders.length ? reminders.map((job) => <button className="upcoming-row upcoming-button" key={job.id} onClick={() => onDetails(job)}><b>{dateLabel(job.nextDate)}</b><span><strong>{job.next || 'Muistutus'}</strong><small>{job.company} · {job.role}</small></span></button>) : <p className="empty">Ei muistutuksia. Lisää seuraava tehtävä hakemuksen tietoihin.</p>}</aside></div>
}
