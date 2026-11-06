import './styles/app-theme.css'
import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { useAuth, UserButton } from '@clerk/clerk-react'
import { apiRequest, downloadMaterialFile, uploadMaterialFile } from './api'
import { clerkProfileAppearance } from './clerkAppearance'
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
const pageKeys = new Set(Object.keys(pages))
function readWorkspaceRoute() {
  const params = new URLSearchParams(window.location.search)
  const requestedSection = params.get('view')
  return {
    section: pageKeys.has(requestedSection) ? requestedSection : 'home',
    assistantJobId: params.get('application') || '',
    selectedJobId: params.get('details') || '',
    formMode: params.get('form') || '',
  }
}
function writeWorkspaceRoute(updates, replace = false) {
  const current = readWorkspaceRoute()
  const route = { ...current, ...updates }
  const url = new URL(window.location.href)
  for (const key of ['view', 'application', 'details', 'form']) url.searchParams.delete(key)
  if (route.section !== 'home') url.searchParams.set('view', route.section)
  if (route.assistantJobId) url.searchParams.set('application', route.assistantJobId)
  if (route.selectedJobId) url.searchParams.set('details', route.selectedJobId)
  if (route.formMode) url.searchParams.set('form', route.formMode)
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
}
const blankForm = () => ({ company: '', role: '', place: '', link: '', cvId: '', templateId: '', cvFileId: '', applicationFileIds: [], applicationText: '', notes: '', status: 'Kiinnostava', added: today(), respondedAt: '', next: '', nextDate: '' })
const formForJob = (job) => ({ company: job.company, role: job.role, place: job.place || '', link: job.link || '', cvId: job.cvId || '', templateId: job.templateId || '', cvFileId: job.cvId ? '' : job.cvFileId || '', applicationFileIds: job.templateId ? [] : job.applicationFileIds || [], applicationText: '', notes: job.notes || job.applicationText || '', status: normalizeStage(job.status), added: job.added || today(), respondedAt: job.respondedAt || firstResponseDate(job.events), next: job.next || '', nextDate: job.nextDate || '' })
function normalizeRejectedEvents(events, status, respondedAt) {
  const result = events.filter((event) => event.type !== 'Hakemus lisätty' && !(event.type === 'Kiinnostava' && event.note?.trim() === 'Hakemus lisätty'))
  if (status !== 'Hylätty') return result
  const rejectionIndex = result.findIndex((event) => event.type === 'Hylätty')
  const receivedIndex = result.findIndex((event) => event.type === 'Vastaus saatu')
  if (rejectionIndex < 0 && receivedIndex >= 0) {
    result[receivedIndex] = { ...result[receivedIndex], type: 'Hylätty', date: respondedAt || result[receivedIndex].date }
  } else if (rejectionIndex >= 0) {
    const rejectionDate = respondedAt || (receivedIndex >= 0 ? result[receivedIndex].date : result[rejectionIndex].date)
    result[rejectionIndex] = { ...result[rejectionIndex], date: rejectionDate }
    if (receivedIndex >= 0 && receivedIndex !== rejectionIndex && result[receivedIndex].date === rejectionDate) result.splice(receivedIndex, 1)
  }
  return result
}

export default function App() {
  const { getToken, isLoaded } = useAuth()
  const [section, setSection] = useState(() => readWorkspaceRoute().section)
  const [navOpen, setNavOpen] = useState(false)
  const [jobs, setJobs] = useState([])
  const [cvs, setCvs] = useState([])
  const [templates, setTemplates] = useState([])
  const [materialFiles, setMaterialFiles] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [theme, setTheme] = useState('default')
  const profileAppearance = useMemo(() => clerkProfileAppearance(theme), [theme])
  const [savingTheme, setSavingTheme] = useState(false)
  const [term, setTerm] = useState('')
  const [stage, setStage] = useState('Kaikki vaiheet')
  const [showForm, setShowForm] = useState(() => Boolean(readWorkspaceRoute().formMode))
  const [editingId, setEditingId] = useState(() => readWorkspaceRoute().formMode.startsWith('edit:') ? readWorkspaceRoute().formMode.slice(5) : null)
  const [restoredEditId, setRestoredEditId] = useState('')
  const [selectedJobId, setSelectedJobId] = useState(() => readWorkspaceRoute().selectedJobId)
  const [assistantJobId, setAssistantJobId] = useState(() => readWorkspaceRoute().assistantJobId)
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
    const restoreRoute = () => {
      const route = readWorkspaceRoute()
      setSection(route.section)
      setAssistantJobId(route.assistantJobId)
      setSelectedJobId(route.selectedJobId)
      setShowForm(Boolean(route.formMode))
      setEditingId(route.formMode.startsWith('edit:') ? route.formMode.slice(5) : null)
      setForm(blankForm())
      setRestoredEditId('')
    }
    window.addEventListener('popstate', restoreRoute)
    return () => window.removeEventListener('popstate', restoreRoute)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.duunicheckTheme = theme
    return () => { delete document.documentElement.dataset.duunicheckTheme }
  }, [theme])

  // Restore the edit form once the jobs have loaded (e.g. after a page reload).
  // State is adjusted during render instead of in an effect, so no extra
  // cascading render is triggered.
  if (showForm && editingId !== null && restoredEditId !== String(editingId)) {
    const job = jobs.find((item) => String(item.id) === String(editingId))
    if (job) {
      setForm(formForJob(job))
      setRestoredEditId(String(editingId))
    }
  }

  function navigateSection(nextSection) {
    setSection(nextSection)
    setShowForm(false)
    setEditingId(null)
    setSelectedJobId('')
    writeWorkspaceRoute({ section: nextSection, selectedJobId: '', formMode: '' })
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    writeWorkspaceRoute({ formMode: '' }, true)
  }

  useEffect(() => {
    if (!isLoaded) return
    let active = true
    Promise.all([
      apiRequest(getToken, '/applications'),
      apiRequest(getToken, '/cvs'),
      apiRequest(getToken, '/templates'),
      apiRequest(getToken, '/files'),
      apiRequest(getToken, '/settings'),
    ]).then(([loadedJobs, loadedCvs, loadedTemplates, loadedFiles, settings]) => {
      if (!active) return
      setJobs(loadedJobs.map((job) => {
        const status = normalizeStage(job.status)
        const respondedAt = job.respondedAt || firstResponseDate(job.events)
        const events = normalizeRejectedEvents(job.events || [], status, respondedAt)
        return { ...job, applicationText: '', notes: job.notes || job.applicationText || '', status, respondedAt, events, initial: job.company?.[0]?.toUpperCase() || '?', color: 'blue' }
      }))
      setCvs(loadedCvs)
      setTemplates(loadedTemplates)
      setMaterialFiles(loadedFiles)
      setTheme(['default', 'dark', 'light'].includes(settings.theme) ? settings.theme : 'default')
      setApiError('')
    }).catch((error) => { if (active) setApiError(error.message) })
      .finally(() => { if (active) setDataLoading(false) })
    return () => { active = false }
  }, [getToken, isLoaded])

  async function changeTheme(event) {
    const nextTheme = event.target.value
    const previousTheme = theme
    setTheme(nextTheme)
    setSavingTheme(true)
    try {
      const saved = await apiRequest(getToken, '/settings', { method: 'PUT', body: { theme: nextTheme } })
      setTheme(saved.theme)
      setApiError('')
    } catch (error) {
      setTheme(previousTheme)
      setApiError(error.message)
    } finally {
      setSavingTheme(false)
    }
  }

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
    setRestoredEditId('')
    writeWorkspaceRoute({ formMode: 'new' })
  }
  function openEdit(job) {
    setEditingId(job.id)
    setForm(formForJob(job))
    setShowForm(true)
    setRestoredEditId(String(job.id))
    writeWorkspaceRoute({ formMode: `edit:${job.id}` })
  }
  function apiApplication(job) {
    const fields = ['company', 'role', 'place', 'link', 'cvId', 'templateId', 'cvFileId', 'applicationFileIds', 'applicationText', 'notes', 'status', 'respondedAt', 'next', 'nextDate', 'added']
    const data = Object.fromEntries(fields.map((field) => [field, job[field] ?? '']))
    data.applicationFileIds = Array.isArray(job.applicationFileIds) ? job.applicationFileIds : []
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
  }  async function saveMaterialFile(category, file) {
    const saved = await uploadMaterialFile(getToken, category, file)
    setMaterialFiles((all) => [saved, ...all])
    setApiError('')
    return saved
  }
  async function removeMaterialFile(id) {
    await apiRequest(getToken, `/files/${id}`, { method: 'DELETE' })
    setMaterialFiles((all) => all.filter((file) => file.id !== id))
  }
  async function downloadFile(file) {
    try { await downloadMaterialFile(getToken, file) } catch (error) { setApiError(error.message) }
  }
  async function updateStatus(id, status) {
    const job = jobs.find((item) => item.id === id)
    if (!job || job.status === status) return
    try {
      const changedDate = today()
      const respondedAt = ['Haastattelu sovittu', 'Hylätty'].includes(status) ? (job.respondedAt || changedDate) : job.respondedAt
      const statusEvent = makeEvent(status, status === 'Hylätty' ? respondedAt : changedDate)
      const events = normalizeRejectedEvents([...job.events, statusEvent], status, respondedAt)
      const saved = await apiRequest(getToken, '/applications/' + id, { method: 'PUT', body: apiApplication({ ...job, status, ...(status === 'Lähetetty' ? { added: changedDate } : {}), respondedAt, events }) })
      setJobs((all) => all.map((item) => item.id === id ? { ...saved, status: normalizeStage(saved.status), initial: saved.company[0]?.toUpperCase() || '?', color: item.color } : item))
      setApiError('')
    } catch (error) { setApiError(error.message) }
  }
  async function addEvent(job, event) {
    const statusForEvent = ({ 'Hakemus jätetty': 'Lähetetty', 'Lähetetty': 'Lähetetty', 'Haastattelu sovittu': 'Haastattelu sovittu', 'Haastattelu pidetty': 'Haastattelu sovittu', 'Hylätty': 'Hylätty' })[event.type]
    const sentEvent = ['Hakemus jätetty', 'Lähetetty'].includes(event.type)
    const responseDate = responseTypes.includes(event.type) ? [job.respondedAt, event.date].filter(Boolean).sort()[0] : job.respondedAt
    const status = statusForEvent || job.status
    const events = normalizeRejectedEvents([...job.events, makeEvent(event.type, event.date, event.note)], status, responseDate)
    const updated = { ...job, ...(sentEvent ? { added: event.date } : {}), respondedAt: responseDate, events, status }
    try {
      const saved = await apiRequest(getToken, '/applications/' + job.id, { method: 'PUT', body: apiApplication(updated) })
      setJobs((all) => all.map((item) => item.id === job.id ? { ...saved, status: normalizeStage(saved.status), initial: saved.company[0]?.toUpperCase() || '?', color: item.color } : item))
      setApiError('')
      return { ok: true }
    } catch (error) { setApiError(error.message); return { ok: false, error: error.message } }
  }
  async function saveEventChanges(job, events) {
    const statusForEvent = (type) => ({ 'Hakemus jätetty': 'Lähetetty', 'Lähetetty': 'Lähetetty', 'Haastattelu sovittu': 'Haastattelu sovittu', 'Haastattelu pidetty': 'Haastattelu sovittu', 'Haastattelu': 'Haastattelu sovittu', 'Hylätty': 'Hylätty' })[type]
    const statusEvents = events.filter((event) => statusForEvent(event.type)).sort((a, b) => a.date.localeCompare(b.date))
    const status = statusEvents.length ? statusForEvent(statusEvents.at(-1).type) : 'Kiinnostava'
    const sentDates = events.filter((event) => ['Lähetetty', 'Hakemus jätetty'].includes(event.type)).map((event) => event.date).filter(Boolean).sort()
    const respondedAt = firstResponseDate(events)
    const normalizedEvents = normalizeRejectedEvents(events, status, respondedAt)
    const updated = { ...job, status, ...(sentDates.length ? { added: sentDates[0] } : {}), respondedAt, events: normalizedEvents }
    try {
      const saved = await apiRequest(getToken, `/applications/${job.id}`, { method: 'PUT', body: apiApplication(updated) })
      setJobs((all) => all.map((item) => item.id === job.id ? { ...saved, status: normalizeStage(saved.status), initial: saved.company[0]?.toUpperCase() || '?', color: item.color } : item))
      setApiError('')
      return { ok: true }
    } catch (error) { setApiError(error.message); return { ok: false, error: error.message } }
  }
  async function updateEvent(job, eventId, changes) {
    const events = job.events.map((item) => String(item.id) === String(eventId) ? { ...item, ...changes } : item)
    return saveEventChanges(job, events)
  }
  async function removeEvent(job, eventId) {
    return saveEventChanges(job, job.events.filter((item) => String(item.id) !== String(eventId)))
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
      setSelectedJobId('')
      writeWorkspaceRoute({ selectedJobId: '' }, true)
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
        if (previous.status !== clean.status && clean.status !== 'Lähetetty') events.push(makeEvent(clean.status, clean.status === 'Hylätty' ? (clean.respondedAt || today()) : today()))
        events = normalizeRejectedEvents(events, clean.status, clean.respondedAt)
        const saved = await apiRequest(getToken, '/applications/' + editingId, { method: 'PUT', body: apiApplication({ ...previous, ...clean, status: clean.status, events }) })
        setJobs((all) => all.map((job) => job.id === editingId ? { ...saved, status: normalizeStage(saved.status), initial: clean.company[0].toUpperCase(), color: job.color } : job))
      } else {
        const initialEvent = clean.status === 'Lähetetty' ? makeEvent('Lähetetty', clean.added) : responseTypes.includes(clean.status) ? makeEvent(clean.status, clean.respondedAt) : null
        const initialEvents = initialEvent ? [initialEvent] : []
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
    navigateSection('jobs')
  }
  function openAssistant(job) {
    const nextJobId = job ? String(job.id) : ''
    setAssistantJobId(nextJobId)
    setSelectedJobId('')
    setSection('assistant')
    writeWorkspaceRoute({ section: 'assistant', assistantJobId: nextJobId, selectedJobId: '' })
  }
  const actions = { onStatus: updateStatus, onEdit: openEdit, onDelete: deleteJob, onDetails: (job) => { setSelectedJobId(String(job.id)); writeWorkspaceRoute({ selectedJobId: String(job.id) }) }, onAdd: openNew }
  const welcomeText = {
    home: 'Hakemukset, vaiheet ja seuraavat askeleet.',
    jobs: 'Kaikki haut ja niiden omat materiaalit samassa paikassa.',
    board: 'Seuraa hakemusten etenemistä ja päivitä vaihetta kortilta.',
    calendar: 'Hakemuksiin liittyvät sovitut seuraavat askeleet.',
    materials: 'Ylläpidä CV-versioita ja hakemuspohjia erillään yksittäisistä hakemuksista.',
    assistant: 'Keskustele hakemuskohtaisesti AI-työparin kanssa ja päätä itse käytettävistä tiedoista.'
  }

  if (dataLoading) return <div className="auth-loading">Ladataan käyttäjän tietoja…</div>
  return <div className="workspace" data-theme={theme}>
    <Sidebar active={section} onNavigate={(key) => { navigateSection(key); setNavOpen(false) }} count={jobs.length} isOpen={navOpen} onClose={() => setNavOpen(false)} onToggle={() => setNavOpen((open) => !open)} />
    <main className="main">
      <header className="topbar"><div><span>DUUNICHECK</span><i>/</i><b>{pageTitle}</b></div><div className="topbar-actions"><label className="theme-control"><span>Teema</span><select aria-label="Väriteema" value={theme} onChange={changeTheme} disabled={savingTheme}><option value="default">Oletus</option><option value="dark">Tumma</option><option value="light">Vaalea</option></select></label><time>{new Intl.DateTimeFormat('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date())}</time><UserButton appearance={profileAppearance} userProfileProps={{ appearance: profileAppearance }}>
        <UserButton.MenuItems>
          <UserButton.Action label="manageAccount" />
          <UserButton.Action label="Käyttöehdot" labelIcon={<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3M6 8h4M6 10.5h4"/></svg>} onClick={() => window.dispatchEvent(new CustomEvent('duunicheck:open-legal', { detail: 'kayttoehdot' }))} />
          <UserButton.Action label="Tietosuojaseloste" labelIcon={<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.8h.01"/></svg>} onClick={() => window.dispatchEvent(new CustomEvent('duunicheck:open-legal', { detail: 'tietosuojaseloste' }))} />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
      </UserButton></div></header>
      <div className={`content${section === 'assistant' ? ' assistant-content' : ''}`}>
        {apiError && <div className="api-error" role="alert">{apiError}</div>}
        <section className="welcome"><div><span className="eyebrow">{section === 'home' ? 'TYÖNHAKU · YLEISKATSAUS' : 'DUUNICHECK · TYÖPÖYTÄ'}</span><h1>{section === 'home' ? 'Työnhaun tilanne' : pageTitle}</h1><p>{welcomeText[section]}</p></div>{['home', 'jobs', 'board'].includes(section) && <button className="add-button" onClick={openNew}>＋ Lisää hakemus</button>}</section>
        {section === 'home' && <DashboardPage jobs={sortedJobs} actions={{ ...actions, onSeeAll: () => navigateSection('jobs') }} />}
        {section === 'jobs' && <ApplicationsPage jobs={matches} actions={actions} term={term} setTerm={setTerm} stage={stage} setStage={setStage} stages={stages} />}
        {section === 'board' && <BoardPage jobs={jobs} actions={actions} />}
        {section === 'calendar' && <CalendarPage jobs={jobs} onDetails={actions.onDetails} />}
        {section === 'materials' && <MaterialsPage cvs={cvs} templates={templates} files={materialFiles} onPrint={setPrintDocument} onSaveCv={(item) => saveMaterial('cv', item)} onDeleteCv={(id) => deleteMaterial('cv', id)} onSaveTemplate={(item) => saveMaterial('template', item)} onDeleteTemplate={(id) => deleteMaterial('template', id)} onUploadFile={saveMaterialFile} onDeleteFile={removeMaterialFile} onDownloadFile={downloadFile} onError={setApiError} />}
        {section === 'assistant' && <AssistantPage key={assistantJobId} jobs={jobs} cvs={cvs} templates={templates} initialJobId={assistantJobId} onSelectJob={(id) => { setAssistantJobId(id); writeWorkspaceRoute({ assistantJobId: id }, true) }} />}
      </div>
    </main>
    {showForm && <ApplicationForm form={form} setForm={setForm} cvs={cvs} templates={templates} files={materialFiles} editing={editingId !== null} onClose={closeForm} onSubmit={saveJob} />}
    {selectedJob && <ApplicationDetails job={selectedJob} cvs={cvs} templates={templates} files={materialFiles} onDownloadFile={downloadFile} onClose={() => { setSelectedJobId(''); writeWorkspaceRoute({ selectedJobId: '' }, true) }} onAddEvent={addEvent} onUpdateEvent={updateEvent} onDeleteEvent={removeEvent} onAssistant={openAssistant} onPrint={setPrintDocument} />}
    <ConfirmDialog open={Boolean(pendingDeleteJob)} title="Poistetaanko hakemus?" description={pendingDeleteJob ? `${pendingDeleteJob.company} · ${pendingDeleteJob.role} ja sen keskustelu poistetaan pysyvästi.` : ''} busy={deletingJob} onConfirm={confirmDeleteJob} onCancel={() => setPendingDeleteJob(null)} />
    <PrintSheet document={printDocument} />
  </div>
}
