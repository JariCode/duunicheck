import './styles/app-theme.css'
import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { useAuth, UserButton } from '@clerk/clerk-react'
import { apiRequest } from './api'
import { clerkAppearance } from './clerkAppearance'
import Sidebar from './components/Sidebar/Sidebar'
import ApplicationForm from './components/ApplicationForm/ApplicationForm'
import ApplicationDetails from './components/ApplicationDetails/ApplicationDetails'
import PrintSheet from './components/PrintSheet/PrintSheet'
import DashboardPage from './pages/DashboardPage/DashboardPage'
import ApplicationsPage from './pages/ApplicationsPage/ApplicationsPage'
import BoardPage from './pages/BoardPage/BoardPage'
import CalendarPage from './pages/CalendarPage/CalendarPage'
import MaterialsPage from './pages/MaterialsPage/MaterialsPage'
import AssistantPage from './pages/AssistantPage/AssistantPage'
import ConfirmDialog from './components/ConfirmDialog/ConfirmDialog'
import { firstResponseDate, makeEvent, normalizeStage, responseTypes, safeHttpUrl, stages, today } from './utils'

const pages = { home: 'Yleiskatsaus', jobs: 'Hakemukset', board: 'Eteneminen', calendar: 'Kalenteri', materials: 'CV & pohjat', assistant: 'AI-chat' }
const blankForm = () => ({ company: '', role: '', place: '', link: '', cvId: '', templateId: '', applicationText: '', status: 'Kiinnostava', added: today(), respondedAt: '', next: '', nextDate: '' })

export default function App() {
  const { getToken, isLoaded } = useAuth()
  const [section, setSection] = useState('home')
  const [navOpen, setNavOpen] = useState(false)
  const [jobs, setJobs] = useState([])
  const [cvs, setCvs] = useState([])
  const [templates, setTemplates] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [term, setTerm] = useState('')
  const [stage, setStage] = useState('Kaikki vaiheet')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [assistantJobId, setAssistantJobId] = useState('')
  const [form, setForm] = useState(blankForm)
  const [printDocument, setPrintDocument] = useState(null)
  const [pendingDeleteJob, setPendingDeleteJob] = useState(null)
  const [deletingJob, setDeletingJob] = useState(false)
  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => (b.added || '').localeCompare(a.added || '')), [jobs])
  const matches = useMemo(() => sortedJobs.filter((job) =>
    (job.company + ' ' + job.role).toLowerCase().includes(term.toLowerCase()) &&
    (stage === 'Kaikki vaiheet' || stage === job.status)), [sortedJobs, term, stage])
  const pageTitle = pages[section] || pages.home
  const selectedJob = jobs.find((job) => job.id === selectedJobId)

  useEffect(() => {
    if (!isLoaded) return
    let active = true
    Promise.all([
      apiRequest(getToken, '/applications'),
      apiRequest(getToken, '/cvs'),
      apiRequest(getToken, '/templates'),
    ]).then(([loadedJobs, loadedCvs, loadedTemplates]) => {
      if (!active) return
      setJobs(loadedJobs.map((job) => ({ ...job, status: normalizeStage(job.status), respondedAt: job.respondedAt || firstResponseDate(job.events), initial: job.company?.[0]?.toUpperCase() || '?', color: 'blue' })))
      setCvs(loadedCvs)
      setTemplates(loadedTemplates)
      setApiError('')
    }).catch((error) => { if (active) setApiError(error.message) })
      .finally(() => { if (active) setDataLoading(false) })
    return () => { active = false }
  }, [getToken, isLoaded])

  useEffect(() => {
    if (!printDocument) return undefined
    const afterPrint = () => setPrintDocument(null)
    window.addEventListener('afterprint', afterPrint)
    const timer = window.setTimeout(() => window.print(), 180)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', afterPrint)
    }
  }, [printDocument])

  function openNew() {
    setEditingId(null)
    setForm(blankForm())
    setShowForm(true)
  }
  function openEdit(job) {
    setEditingId(job.id)
    setForm({ company: job.company, role: job.role, place: job.place || '', link: job.link || '', cvId: job.cvId || '', templateId: job.templateId || '', applicationText: job.applicationText || '', status: normalizeStage(job.status), added: job.added || today(), respondedAt: job.respondedAt || firstResponseDate(job.events), next: job.next || '', nextDate: job.nextDate || '' })
    setShowForm(true)
  }
  function apiApplication(job) {
    const fields = ['company', 'role', 'place', 'link', 'cvId', 'templateId', 'applicationText', 'status', 'respondedAt', 'next', 'nextDate', 'added']
    const data = Object.fromEntries(fields.map((field) => [field, job[field] ?? '']))
    data.events = Array.isArray(job.events) ? job.events.map(({ id, type, date, note }) => ({ id, type, date, note: note ?? '' })) : []
    return data
  }
  function apiMaterial(item) {
    const data = { ...item }
    for (const key of ['id', '_id', 'createdAt', 'updatedAt']) delete data[key]
    return data
  }
  async function saveMaterial(kind, item) {
    const path = kind === 'cv' ? '/cvs' : '/templates'
    const saved = item.id
      ? await apiRequest(getToken, `${path}/${item.id}`, { method: 'PUT', body: apiMaterial(item) })
      : await apiRequest(getToken, path, { method: 'POST', body: apiMaterial(item) })
    const setter = kind === 'cv' ? setCvs : setTemplates
    setter((all) => item.id ? all.map((entry) => entry.id === item.id ? saved : entry) : [saved, ...all])
    setApiError('')
  }
  async function deleteMaterial(kind, id) {
    const path = kind === 'cv' ? '/cvs' : '/templates'
    await apiRequest(getToken, `${path}/${id}`, { method: 'DELETE' })
    const setter = kind === 'cv' ? setCvs : setTemplates
    setter((all) => all.filter((entry) => entry.id !== id))
  }
  async function updateStatus(id, status) {
    const job = jobs.find((item) => item.id === id)
    if (!job || job.status === status) return
    try {
      const changedDate = today()
      const saved = await apiRequest(getToken, '/applications/' + id, { method: 'PUT', body: apiApplication({ ...job, status, ...(status === 'Lähetetty' ? { added: changedDate } : {}), respondedAt: ['Haastattelu sovittu', 'Hylätty'].includes(status) ? (job.respondedAt || changedDate) : job.respondedAt, events: [...job.events, makeEvent(status, changedDate)] }) })
      setJobs((all) => all.map((item) => item.id === id ? { ...saved, status: normalizeStage(saved.status), initial: saved.company[0]?.toUpperCase() || '?', color: item.color } : item))
      setApiError('')
    } catch (error) { setApiError(error.message) }
  }
  async function addEvent(job, event) {
    const statusForEvent = ({ 'Hakemus jätetty': 'Lähetetty', 'Lähetetty': 'Lähetetty', 'Haastattelu sovittu': 'Haastattelu sovittu', 'Haastattelu pidetty': 'Haastattelu sovittu', 'Hylätty': 'Hylätty' })[event.type]
    const sentEvent = ['Hakemus jätetty', 'Lähetetty'].includes(event.type)
    const responseDate = responseTypes.includes(event.type) ? [job.respondedAt, event.date].filter(Boolean).sort()[0] : job.respondedAt
    const updated = { ...job, ...(sentEvent ? { added: event.date } : {}), respondedAt: responseDate, events: [...job.events, makeEvent(event.type, event.date, event.note)], ...(statusForEvent ? { status: statusForEvent } : {}) }
    try {
      const saved = await apiRequest(getToken, '/applications/' + job.id, { method: 'PUT', body: apiApplication(updated) })
      setJobs((all) => all.map((item) => item.id === job.id ? { ...saved, status: normalizeStage(saved.status), initial: saved.company[0]?.toUpperCase() || '?', color: item.color } : item))
      setApiError('')
    } catch (error) { setApiError(error.message) }
  }
  async function deleteJob(job) {
    setPendingDeleteJob(job)
  }
  async function confirmDeleteJob() {
    if (!pendingDeleteJob || deletingJob) return
    setDeletingJob(true)
    try {
      await apiRequest(getToken, `/applications/${pendingDeleteJob.id}`, { method: 'DELETE' })
      setJobs((all) => all.filter((item) => item.id !== pendingDeleteJob.id))
      setSelectedJobId(null)
      setApiError('')
      setPendingDeleteJob(null)
    } catch (error) { setApiError(error.message); setPendingDeleteJob(null) }
    finally { setDeletingJob(false) }
  }
  async function saveJob(event) {
    event.preventDefault()
    if (!form.company.trim() || !form.role.trim()) return
    const clean = { ...form, company: form.company.trim(), role: form.role.trim(), link: safeHttpUrl(form.link.trim()), added: form.added || today(), respondedAt: form.respondedAt || '' }
    if (responseTypes.includes(clean.status) && !clean.respondedAt) clean.respondedAt = today()
    try {
      if (editingId !== null) {
        const previous = jobs.find((job) => job.id === editingId)
        let events = [...previous.events]
        const sentIndex = events.findIndex((item) => ['Lähetetty', 'Hakemus jätetty'].includes(item.type))
        if (sentIndex >= 0) events[sentIndex] = { ...events[sentIndex], date: clean.added }
        else if (clean.status === 'Lähetetty') events.push(makeEvent('Lähetetty', clean.added))
        const responseIndex = events.reduce((best, item, index) => responseTypes.includes(item.type) && (best < 0 || item.date < events[best].date) ? index : best, -1)
        const previousResponseDate = previous.respondedAt || firstResponseDate(previous.events)
        if (clean.respondedAt) {
          if (responseIndex >= 0 && clean.respondedAt !== previousResponseDate) events[responseIndex] = { ...events[responseIndex], date: clean.respondedAt }
          else if (responseIndex < 0) events.push(makeEvent('Vastaus saatu', clean.respondedAt))
        } else if (responseIndex >= 0) clean.respondedAt = previousResponseDate || events[responseIndex].date
        if (previous.status !== clean.status && clean.status !== 'Lähetetty') events.push(makeEvent(clean.status, today()))
        const saved = await apiRequest(getToken, '/applications/' + editingId, { method: 'PUT', body: apiApplication({ ...previous, ...clean, status: clean.status, events }) })
        setJobs((all) => all.map((job) => job.id === editingId ? { ...saved, status: normalizeStage(saved.status), initial: clean.company[0].toUpperCase(), color: job.color } : job))
      } else {
        const initialEvent = clean.status === 'Lähetetty' ? makeEvent('Lähetetty', clean.added) : responseTypes.includes(clean.status) ? makeEvent(clean.status, clean.respondedAt) : makeEvent('Hakemus lisätty', today())
        const initialEvents = [initialEvent]
        if (clean.respondedAt && !responseTypes.includes(clean.status)) initialEvents.push(makeEvent('Vastaus saatu', clean.respondedAt))
        const created = await apiRequest(getToken, '/applications', { method: 'POST', body: apiApplication({ ...clean, events: initialEvents }) })
        setJobs((all) => [{ ...created, status: normalizeStage(created.status), initial: clean.company[0].toUpperCase(), color: 'coral' }, ...all])
      }
      setApiError('')
    } catch (error) {
      setApiError(error.message)
      return
    }
    setShowForm(false)
    setEditingId(null)
    setSection('jobs')
  }
  function openAssistant(job) {
    setAssistantJobId(job ? String(job.id) : '')
    setSelectedJobId(null)
    setSection('assistant')
  }
  const actions = { onStatus: updateStatus, onEdit: openEdit, onDelete: deleteJob, onDetails: (job) => setSelectedJobId(job.id), onAdd: openNew }
  const welcomeText = {
    home: 'Hakemukset, vaiheet ja seuraavat askeleet.',
    jobs: 'Kaikki haut ja niiden omat materiaalit samassa paikassa.',
    board: 'Seuraa hakemusten etenemistä ja päivitä vaihetta kortilta.',
    calendar: 'Hakemuksiin liittyvät sovitut seuraavat askeleet.',
    materials: 'Ylläpidä CV-versioita ja hakemuspohjia erillään yksittäisistä hakemuksista.',
    assistant: 'Keskustele hakemuskohtaisesti AI-työparin kanssa ja päätä itse käytettävistä tiedoista.'
  }

  if (dataLoading) return <div className="auth-loading">Ladataan käyttäjän tietoja…</div>
  return <div className="workspace">
    <Sidebar active={section} onNavigate={(key) => { setSection(key); setNavOpen(false) }} count={jobs.length} isOpen={navOpen} onClose={() => setNavOpen(false)} onToggle={() => setNavOpen((open) => !open)} />
    <main className="main">
      <header className="topbar"><div><span>DUUNICHECK</span><i>/</i><b>{pageTitle}</b></div><div className="topbar-actions"><time>{new Intl.DateTimeFormat('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date())}</time><UserButton userProfileProps={{ appearance: clerkAppearance }} /></div></header>
      <div className="content">
        {apiError && <div className="api-error" role="alert">{apiError}</div>}
        <section className="welcome"><div><span className="eyebrow">{section === 'home' ? 'TYÖNHAKU · YLEISKATSAUS' : 'DUUNICHECK · TYÖPÖYTÄ'}</span><h1>{section === 'home' ? 'Työnhaun tilanne' : pageTitle}</h1><p>{welcomeText[section]}</p></div>{['home', 'jobs', 'board'].includes(section) && <button className="add-button" onClick={openNew}>＋ Lisää hakemus</button>}</section>
        {section === 'home' && <DashboardPage jobs={sortedJobs} actions={{ ...actions, onSeeAll: () => setSection('jobs') }} />}
        {section === 'jobs' && <ApplicationsPage jobs={matches} actions={actions} term={term} setTerm={setTerm} stage={stage} setStage={setStage} stages={stages} />}
        {section === 'board' && <BoardPage jobs={jobs} actions={actions} />}
        {section === 'calendar' && <CalendarPage jobs={jobs} onDetails={actions.onDetails} />}
        {section === 'materials' && <MaterialsPage cvs={cvs} templates={templates} onPrint={setPrintDocument} onSaveCv={(item) => saveMaterial('cv', item)} onDeleteCv={(id) => deleteMaterial('cv', id)} onSaveTemplate={(item) => saveMaterial('template', item)} onDeleteTemplate={(id) => deleteMaterial('template', id)} onError={setApiError} />}
        {section === 'assistant' && <AssistantPage key={assistantJobId} jobs={jobs} cvs={cvs} templates={templates} initialJobId={assistantJobId} />}
      </div>
    </main>
    {showForm && <ApplicationForm form={form} setForm={setForm} cvs={cvs} templates={templates} editing={editingId !== null} onClose={() => setShowForm(false)} onSubmit={saveJob} />}
    {selectedJob && <ApplicationDetails job={selectedJob} cvs={cvs} onClose={() => setSelectedJobId(null)} onAddEvent={addEvent} onAssistant={openAssistant} onPrint={setPrintDocument} />}
    <ConfirmDialog open={Boolean(pendingDeleteJob)} title="Poistetaanko hakemus?" description={pendingDeleteJob ? `${pendingDeleteJob.company} · ${pendingDeleteJob.role} ja sen keskustelu poistetaan pysyvästi.` : ''} busy={deletingJob} onConfirm={confirmDeleteJob} onCancel={() => setPendingDeleteJob(null)} />
    <PrintSheet document={printDocument} />
  </div>
}
