import './styles/app-theme.css'
import './App.css'
import { useEffect, useMemo, useState } from 'react'
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
import { makeEvent, safeHttpUrl, startingCvs, startingJobs, startingTemplates, stages, today } from './utils'

const pages = { home: 'Yleiskatsaus', jobs: 'Hakemukset', board: 'Eteneminen', calendar: 'Kalenteri', materials: 'CV & pohjat', assistant: 'AI-chat' }
const blankForm = () => ({ company: '', role: '', place: '', link: '', cvId: '', templateId: '', applicationText: '', status: 'Kiinnostava', next: '', nextDate: '' })

export default function App() {
  const [section, setSection] = useState('home')
  const [navOpen, setNavOpen] = useState(false)
  const [jobs, setJobs] = useState(startingJobs)
  const [cvs, setCvs] = useState(startingCvs)
  const [templates, setTemplates] = useState(startingTemplates)
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
  function updateStatus(id, status) {
    setJobs((all) => all.map((job) => job.id === id && job.status !== status ? { ...job, status, events: [...job.events, makeEvent(status, today())] } : job))
  }
  function addEvent(job, event) {
    const statusForEvent = ({ 'Hakemus jätetty': 'Lähetetty', 'Lähetetty': 'Lähetetty', 'Haastattelu sovittu': 'Haastattelu', 'Haastattelu pidetty': 'Haastattelu', 'Tarjous': 'Tarjous', 'Hylätty': 'Hylätty' })[event.type]
    const updated = { ...job, events: [...job.events, makeEvent(event.type, event.date, event.note)], ...(statusForEvent ? { status: statusForEvent } : {}) }
    setJobs((all) => all.map((item) => item.id === job.id ? updated : item))
  }
  function deleteJob(job) {
    if (window.confirm('Poistetaanko ' + job.company + ' / ' + job.role + ' hakemus?')) {
      setJobs((all) => all.filter((item) => item.id !== job.id))
      setSelectedJobId(null)
    }
  }
  function saveJob(event) {
    event.preventDefault()
    if (!form.company.trim() || !form.role.trim()) return
    const clean = { ...form, company: form.company.trim(), role: form.role.trim(), link: safeHttpUrl(form.link.trim()) }
    if (editingId !== null) {
      setJobs((all) => all.map((job) => {
        if (job.id !== editingId) return job
        const events = job.status !== clean.status ? [...job.events, makeEvent(clean.status, today())] : job.events
        return { ...job, ...clean, status: clean.status, events, initial: clean.company[0].toUpperCase() }
      }))
    } else {
      const created = { ...clean, id: Date.now(), added: today(), initial: clean.company[0].toUpperCase(), color: 'coral', events: [makeEvent(clean.status, today(), 'Hakemus lisätty')] }
      setJobs((all) => [created, ...all])
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

  return <div className="workspace">
    <Sidebar active={section} onNavigate={(key) => { setSection(key); setNavOpen(false) }} count={jobs.length} isOpen={navOpen} onClose={() => setNavOpen(false)} onToggle={() => setNavOpen((open) => !open)} />
    <main className="main">
      <header className="topbar"><div><span>DUUNICHECK</span><i>/</i><b>{pageTitle}</b></div><div className="topbar-actions"><time>{new Intl.DateTimeFormat('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date())}</time><span className="top-avatar">JK</span></div></header>
      <div className="content">
        <section className="welcome"><div><span className="eyebrow">{section === 'home' ? 'TYÖNHAKU · YLEISKATSAUS' : 'DUUNICHECK · TYÖPÖYTÄ'}</span><h1>{section === 'home' ? 'Työnhaun tilanne' : pageTitle}</h1><p>{welcomeText[section]}</p></div>{['home', 'jobs', 'board'].includes(section) && <button className="add-button" onClick={openNew}>＋ Lisää hakemus</button>}</section>
        {section === 'home' && <DashboardPage jobs={jobs} actions={{ ...actions, onSeeAll: () => setSection('jobs') }} />}
        {section === 'jobs' && <ApplicationsPage jobs={matches} actions={actions} term={term} setTerm={setTerm} stage={stage} setStage={setStage} stages={stages} />}
        {section === 'board' && <BoardPage jobs={jobs} actions={actions} />}
        {section === 'calendar' && <CalendarPage jobs={jobs} onDetails={actions.onDetails} />}
        {section === 'materials' && <MaterialsPage cvs={cvs} setCvs={setCvs} templates={templates} setTemplates={setTemplates} onPrint={setPrintDocument} />}
        {section === 'assistant' && <AssistantPage key={assistantJobId} jobs={jobs} cvs={cvs} templates={templates} initialJobId={assistantJobId} />}
      </div>
    </main>
    {showForm && <ApplicationForm form={form} setForm={setForm} cvs={cvs} templates={templates} editing={editingId !== null} onClose={() => setShowForm(false)} onSubmit={saveJob} />}
    {selectedJob && <ApplicationDetails job={selectedJob} cvs={cvs} onClose={() => setSelectedJobId(null)} onEdit={(job) => { setSelectedJobId(null); openEdit(job) }} onDelete={deleteJob} onAddEvent={addEvent} onAssistant={openAssistant} onPrint={setPrintDocument} />}
    <PrintSheet document={printDocument} />
  </div>
}
