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
import { makeEvent, safeHttpUrl, stages, today } from './utils'

const pages = { home: 'Yleiskatsaus', jobs: 'Hakemukset', board: 'Eteneminen', calendar: 'Kalenteri', materials: 'CV & pohjat', assistant: 'AI-chat' }
const blankForm = () => ({ company: '', role: '', place: '', link: '', cvId: '', templateId: '', applicationText: '', status: 'Kiinnostava', next: '', nextDate: '' })

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
  const matches = useMemo(() => jobs.filter((job) =>
    (job.company + ' ' + job.role).toLowerCase().includes(term.toLowerCase()) &&
    (stage === 'Kaikki vaiheet' || stage === job.status)), [jobs, term, stage])
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
      setJobs(loadedJobs.map((job) => ({ ...job, initial: job.company?.[0]?.toUpperCase() || '?', color: 'blue' })))
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
    setForm({ company: job.company, role: job.role, place: job.place || '', link: job.link || '', cvId: job.cvId || '', templateId: job.templateId || '', applicationText: job.applicationText || '', status: job.status, next: job.next || '', nextDate: job.nextDate || '' })
    setShowForm(true)
  }
  function apiApplication(job) {
    const data = { ...job }
    for (const key of ['id', '_id', 'initial', 'color', 'createdAt', 'updatedAt']) delete data[key]
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
      const saved = await apiRequest(getToken, `/applications/${id}`, { method: 'PUT', body: apiApplication({ ...job, status, events: [...job.events, makeEvent(status, today())] }) })
      setJobs((all) => all.map((item) => item.id === id ? { ...saved, initial: saved.company[0]?.toUpperCase() || '?', color: item.color } : item))
      setApiError('')
    } catch (error) { setApiError(error.message) }
  }
  async function addEvent(job, event) {
    const statusForEvent = ({ 'Hakemus jätetty': 'Lähetetty', 'Lähetetty': 'Lähetetty', 'Haastattelu sovittu': 'Haastattelu', 'Haastattelu pidetty': 'Haastattelu', 'Tarjous': 'Tarjous', 'Hylätty': 'Hylätty' })[event.type]
    const updated = { ...job, events: [...job.events, makeEvent(event.type, event.date, event.note)], ...(statusForEvent ? { status: statusForEvent } : {}) }
    try {
      const saved = await apiRequest(getToken, `/applications/${job.id}`, { method: 'PUT', body: apiApplication(updated) })
      setJobs((all) => all.map((item) => item.id === job.id ? { ...saved, initial: saved.company[0]?.toUpperCase() || '?', color: item.color } : item))
      setApiError('')
    } catch (error) { setApiError(error.message) }
  }
  async function deleteJob(job) {
    if (window.confirm('Poistetaanko ' + job.company + ' / ' + job.role + ' hakemus?')) {
      try {
        await apiRequest(getToken, `/applications/${job.id}`, { method: 'DELETE' })
        setJobs((all) => all.filter((item) => item.id !== job.id))
        setSelectedJobId(null)
        setApiError('')
      } catch (error) { setApiError(error.message) }
    }
  }
  async function saveJob(event) {
    event.preventDefault()
    if (!form.company.trim() || !form.role.trim()) return
    const clean = { ...form, company: form.company.trim(), role: form.role.trim(), link: safeHttpUrl(form.link.trim()) }
    try {
      if (editingId !== null) {
        const previous = jobs.find((job) => job.id === editingId)
        const events = previous.status !== clean.status ? [...previous.events, makeEvent(clean.status, today())] : previous.events
        const saved = await apiRequest(getToken, `/applications/${editingId}`, { method: 'PUT', body: apiApplication({ ...previous, ...clean, status: clean.status, events }) })
        setJobs((all) => all.map((job) => job.id === editingId ? { ...saved, initial: clean.company[0].toUpperCase(), color: job.color } : job))
      } else {
        const created = await apiRequest(getToken, '/applications', { method: 'POST', body: { ...clean, added: today(), events: [makeEvent(clean.status, today(), 'Hakemus lisätty')] } })
        setJobs((all) => [{ ...created, initial: clean.company[0].toUpperCase(), color: 'coral' }, ...all])
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
        {section === 'home' && <DashboardPage jobs={jobs} actions={{ ...actions, onSeeAll: () => setSection('jobs') }} />}
        {section === 'jobs' && <ApplicationsPage jobs={matches} actions={actions} term={term} setTerm={setTerm} stage={stage} setStage={setStage} stages={stages} />}
        {section === 'board' && <BoardPage jobs={jobs} actions={actions} />}
        {section === 'calendar' && <CalendarPage jobs={jobs} onDetails={actions.onDetails} />}
        {section === 'materials' && <MaterialsPage cvs={cvs} templates={templates} onPrint={setPrintDocument} onSaveCv={(item) => saveMaterial('cv', item)} onDeleteCv={(id) => deleteMaterial('cv', id)} onSaveTemplate={(item) => saveMaterial('template', item)} onDeleteTemplate={(id) => deleteMaterial('template', id)} onError={setApiError} />}
        {section === 'assistant' && <AssistantPage key={assistantJobId} jobs={jobs} cvs={cvs} templates={templates} initialJobId={assistantJobId} />}
      </div>
    </main>
    {showForm && <ApplicationForm form={form} setForm={setForm} cvs={cvs} templates={templates} editing={editingId !== null} onClose={() => setShowForm(false)} onSubmit={saveJob} />}
    {selectedJob && <ApplicationDetails job={selectedJob} cvs={cvs} onClose={() => setSelectedJobId(null)} onEdit={(job) => { setSelectedJobId(null); openEdit(job) }} onDelete={deleteJob} onAddEvent={addEvent} onAssistant={openAssistant} onPrint={setPrintDocument} />}
    <PrintSheet document={printDocument} />
  </div>
}
