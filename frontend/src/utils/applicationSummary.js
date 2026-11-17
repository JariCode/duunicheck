// The application summary print ("Tulosta hakemus / PDF"): everything about one application as plain
// text values, built once and drawn by both PrintSheet (Chrome's print) and printPdf.js (the PDF on
// Mac Safari, the Mac Dock app and the iOS home screen app), so both show exactly the same content.
import { firstResponseDate, normalizeStage, safeHttpUrl, sentTypes } from '../utils.js'

// pp.kk.vvvv in Finnish time; '' for an empty or invalid date.
export function summaryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return ''
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

export function printedDate(date = new Date()) {
  return new Intl.DateTimeFormat('fi-FI', {
    timeZone: 'Europe/Helsinki',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

// The send date the dashboard uses (DashboardStats getSentDate): the sent event, otherwise the
// application's own send date while it is in the "Lähetetty" stage.
export function sentDate(job) {
  const sent = (job.events || []).filter((event) => sentTypes.includes(event.type) && event.date)
  if (sent.length) return sent.map((event) => event.date).sort()[0]
  return normalizeStage(job.status) === 'Lähetetty' ? job.added || '' : ''
}

// Attachments as in the application details view, deleted ones as "… on poistettu".
function attachments(job, { cvs, templates, files }) {
  const cv = cvs.find((item) => item.id === job.cvId)
  const template = templates.find((item) => item.id === job.templateId)
  const cvFile = files.find((item) => item.id === job.cvFileId)
  const fileIds = job.applicationFileIds || []
  const letterFiles = files.filter((item) => fileIds.includes(item.id))
  const missingFiles = fileIds.filter((id) => !files.some((item) => item.id === id)).length
  return [
    cv && { label: 'Sovelluksen CV', value: cv.name },
    cvFile && { label: 'CV-tiedosto', value: cvFile.name },
    template && { label: 'Hakemuspohja', value: template.name },
    ...letterFiles.map((file) => ({ label: 'Hakukirjetiedosto', value: file.name })),
    job.cvId && !cv && { missing: 'CV on poistettu' },
    job.cvFileId && !cvFile && { missing: 'CV-tiedosto on poistettu' },
    job.templateId && !template && { missing: 'Hakemuspohja on poistettu' },
    missingFiles === 1 && { missing: 'Tiedosto on poistettu' },
    missingFiles > 1 && { missing: `${missingFiles} tiedostoa on poistettu` },
  ].filter(Boolean)
}

// The print document for PrintSheet and printPdf.js. Empty values and empty sections are left out.
export function applicationSummaryDocument(job, { cvs = [], templates = [], files = [], date = new Date() } = {}) {
  const text = (value) => String(value || '').trim()
  const link = safeHttpUrl(text(job.link))
  const facts = [
    ['Yritys', text(job.company)],
    ['Tehtävä', text(job.role)],
    ['Sijainti', text(job.place)],
    ['Ilmoituksen linkki', link, link],
    ['Vaihe', text(normalizeStage(job.status))],
    ['Lähetyspäivä', summaryDate(sentDate(job))],
    ['Vastauspäivä', summaryDate(job.respondedAt || firstResponseDate(job.events || []))],
    ['Seuraava tehtävä', text(job.next)],
    ['Muistutuspäivä', summaryDate(job.nextDate)],
  ]
    .filter(([, value]) => value)
    .map(([label, value, href]) => ({ label, value, ...(href ? { href } : {}) }))
  // Newest first, like the details view.
  const events = [...(job.events || [])]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.id) - Number(a.id))
    .map((event) => ({ date: summaryDate(event.date), type: text(event.type), note: text(event.note) }))
  // The notes as the app shows them: the app keeps the old application text (applicationText) only as
  // the notes when there are none (App.jsx), so it has no section of its own.
  const notes = text(job.notes)
  return {
    kind: 'applicationSummary',
    title: text(job.role),
    subtitle: [text(job.company), text(job.place)].filter(Boolean).join(' · '),
    printed: `Tulostettu ${printedDate(date)}`,
    facts,
    attachments: attachments(job, { cvs, templates, files }),
    events,
    notes,
    // For the PDF file name and title.
    job: { company: text(job.company), role: text(job.role) },
  }
}
