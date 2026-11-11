// Turns imported rows into application drafts. Every draft is validated with the same
// applicationSchema as POST /api/applications; invalid fields are cleared instead of
// dropping the whole row. Nothing here saves anything.
import { applicationSchema, applicationStatuses, eventSchema } from './sanitize.js'

// Event types the application already uses (ApplicationDetails event list).
export const importEventTypes = [
  'Hakemus jätetty',
  'Lähetetty',
  'Vastaus saatu',
  'Haastattelu sovittu',
  'Haastattelu pidetty',
  'Tarjous',
  'Hyväksytty',
  'Hylätty',
  'Muu tapahtuma',
]

const importFields = [
  'company',
  'role',
  'place',
  'link',
  'status',
  'added',
  'respondedAt',
  'next',
  'nextDate',
  'notes',
  'applicationText',
]
const fieldLabels = {
  company: 'Yritys',
  role: 'Tehtävä',
  place: 'Paikkakunta',
  link: 'Linkki',
  status: 'Tila',
  added: 'Lähetyspäivä',
  respondedAt: 'Vastauspäivä',
  next: 'Seuraava tehtävä',
  nextDate: 'Muistutuspäivä',
  notes: 'Muistiinpanot',
  applicationText: 'Hakemusteksti',
}

const normalizeKey = (value) =>
  String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// Exact statuses (any letter case or spacing) and unambiguous synonyms.
const statusSynonyms = new Map([
  ...applicationStatuses.map((status) => [normalizeKey(status), status]),
  ['kiinnostaa', 'Kiinnostava'],
  ['interested', 'Kiinnostava'],
  ['haettu', 'Lähetetty'],
  ['hakemus lähetetty', 'Lähetetty'],
  ['applied', 'Lähetetty'],
  ['sent', 'Lähetetty'],
  ['haastattelu', 'Haastattelu sovittu'],
  ['interview', 'Haastattelu sovittu'],
  ['sain paikan', 'Hyväksytty'],
  ['offer accepted', 'Hyväksytty'],
  ['accepted', 'Hyväksytty'],
  ['rejected', 'Hylätty'],
  ['ei valittu', 'Hylätty'],
])

export function normalizeStatus(value, statusMap = {}) {
  const key = normalizeKey(value)
  if (!key) return ''
  const mapped = statusSynonyms.get(key) || statusMap[key]
  return applicationStatuses.includes(mapped) ? mapped : ''
}

const isCalendarDate = (year, month, day) => {
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    year >= 1900 &&
    year <= 2200 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}
const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

// Accepts YYYY-MM-DD (Excel date cells arrive in this form) and Finnish d.m.yyyy.
export function parseImportDate(value) {
  const text = String(value ?? '').trim()
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/)
  if (match) {
    const [, y, m, d] = match.map(Number)
    return isCalendarDate(y, m, d) ? iso(y, m, d) : ''
  }
  match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?(?:\s.*)?$/)
  if (match) {
    const [, d, m, y] = match.map(Number)
    return isCalendarDate(y, m, d) ? iso(y, m, d) : ''
  }
  return ''
}

export function httpHref(value) {
  try {
    const url = new URL(String(value ?? '').trim())
    return ['http:', 'https:'].includes(url.protocol) && url.href.length <= 2048 ? url.href : ''
  } catch {
    return ''
  }
}

const notesHeader = /^\s*(muistiinpanot?|notes?|lisätiedot|kommentit?|huomiot?)\s*$/i
const yes = /^(kyllä|kylla|k|joo|yes|y|x|true|1|✓|✔)$/i
const no = /^(ei|e|no|n|false|0|-)$/i
const cellText = (cell) => (typeof cell === 'string' ? cell : cell?.t || '').trim()
const cellLink = (cell) => (typeof cell === 'object' && cell ? httpHref(cell.l) : '')
let eventCounter = 0
const eventId = () => Date.now() + (eventCounter = (eventCounter + 1) % 1000) / 1000

const responseEventType = (status) =>
  ({ Hylätty: 'Hylätty', Hyväksytty: 'Hyväksytty', 'Haastattelu sovittu': 'Haastattelu sovittu' })[status] ||
  'Vastaus saatu'

// Converts one spreadsheet row with the column mapping. The model never writes rows, so
// every value comes from the file and no row can be added or lost.
function convertRow(row, sheetIndex, columns, mapping, statusMap) {
  const fields = Object.fromEntries(importFields.map((field) => [field, '']))
  const issues = []
  const notes = []
  const used = new Set()
  let interviewDate = ''
  let responded = null
  let statusRaw = ''

  columns.forEach((column, columnIndex) => {
    const field = mapping[`${sheetIndex}:${columnIndex}`] || 'ignore'
    const cell = row.c[columnIndex]
    const text = cellText(cell)
    const link = cellLink(cell)
    if (field === 'ignore' || (!text && !link)) return
    // A column that already is the notes column needs no label prefix.
    if (field === 'notes' && notesHeader.test(column.label)) {
      notes.push(text || link)
      return
    }
    if (field === 'notes' || used.has(field)) {
      notes.push(`${column.label}: ${text || link}`)
      return
    }
    used.add(field)
    if (['company', 'role', 'place', 'next'].includes(field)) fields[field] = text
    else if (field === 'link') {
      const href = link || httpHref(text)
      if (href) fields.link = href
      else {
        notes.push(`${column.label}: ${text}`)
        issues.push(`${column.label}: linkki ei ole http- tai https-osoite, joten se siirrettiin muistiinpanoihin.`)
      }
    } else if (field === 'status') {
      statusRaw = text
      fields.status = normalizeStatus(text, statusMap)
      if (!fields.status) issues.push(`Tilaa "${text}" ei tunnistettu. Valitse tila.`)
    } else if (['added', 'respondedAt', 'nextDate', 'interviewDate'].includes(field)) {
      const date = parseImportDate(text)
      if (!date) issues.push(`${column.label}: päivämäärää "${text}" ei tunnistettu.`)
      else if (field === 'interviewDate') interviewDate = date
      else fields[field] = date
    } else if (field === 'responded') {
      if (yes.test(text)) responded = true
      else if (no.test(text)) responded = false
      else notes.push(`${column.label}: ${text}`)
    }
  })

  // An empty status cell follows the app's own rule: sent if there is a send date, otherwise interesting.
  if (!statusRaw) fields.status = fields.added ? 'Lähetetty' : 'Kiinnostava'
  const events = []
  const addEvent = (type, date, note = '') => {
    if (date && !events.some((event) => event.type === type && event.date === date))
      events.push({ id: eventId(), type, date, note })
  }
  if (fields.added && fields.status !== 'Kiinnostava') addEvent('Lähetetty', fields.added)
  if (fields.respondedAt) addEvent(responseEventType(fields.status), fields.respondedAt)
  if (interviewDate) {
    addEvent('Haastattelu sovittu', interviewDate, 'Haastattelupäivä')
    if (!fields.next && !fields.nextDate) {
      fields.next = 'Haastattelu'
      fields.nextDate = interviewDate
    }
  }
  if (responded === true && !fields.respondedAt) notes.push('Vastattu (päivä puuttuu)')
  fields.notes = notes.join('\n')
  fields.events = events
  return { fields, issues, source: `rivi ${row.n}` }
}

export function convertTable(table) {
  const drafts = []
  table.sheets.forEach((sheet, sheetIndex) => {
    for (const row of sheet.rows) {
      const draft = convertRow(row, sheetIndex, sheet.columns, table.mapping, table.statusMap)
      if (table.sheets.length > 1) draft.source = `${sheet.name}, ${draft.source}`
      drafts.push(draft)
    }
  })
  return drafts
}

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

// Validates a draft with applicationSchema. Invalid fields are emptied; a missing company
// or role makes the draft incomplete so it cannot be saved before it is fixed.
export function finalizeDraft({ fields = {}, issues = [], source = '' }) {
  const data = Object.fromEntries(importFields.map((field) => [field, clip(fields[field], 20000)]))
  const problems = [...issues]
  if (data.status && !applicationStatuses.includes(data.status)) data.status = ''
  const events = []
  for (const event of (Array.isArray(fields.events) ? fields.events : []).slice(0, 300)) {
    const type = clip(event?.type, 100)
    if (!type) continue
    const candidate = {
      id: typeof event.id === 'number' ? event.id : eventId(),
      type,
      date: clip(event?.date, 20),
      note: clip(event?.note, 2000),
    }
    let parsed = eventSchema.safeParse(candidate)
    if (!parsed.success && candidate.date) {
      problems.push(`Tapahtuman "${type}" päivämäärä ei kelvannut, joten se tyhjennettiin.`)
      parsed = eventSchema.safeParse({ ...candidate, date: '' })
    }
    if (parsed.success) events.push(parsed.data)
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = applicationSchema.safeParse({
      ...data,
      company: data.company || '-',
      role: data.role || '-',
      status: data.status || 'Kiinnostava',
      events,
    })
    if (result.success) break
    const invalid = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '')))].filter(
      (field) => field in data,
    )
    if (!invalid.length) {
      events.length = 0
      continue
    }
    for (const field of invalid) {
      if (data[field]) problems.push(`${fieldLabels[field]}: arvo ei kelvannut, joten kenttä tyhjennettiin.`)
      data[field] = ''
    }
  }
  if (!data.status && !problems.some((problem) => problem.startsWith('Tila')))
    problems.push('Tila puuttuu tai on epäselvä. Valitse tila.')
  const incomplete = !data.company || !data.role
  return { fields: { ...data, events }, issues: problems, incomplete, review: problems.length > 0, source }
}

const linkKey = (link) => {
  const href = httpHref(link)
  return href ? `l:${href}` : ''
}
const nameKey = (company, role) =>
  normalizeKey(company) && normalizeKey(role) ? `n:${normalizeKey(company)}|${normalizeKey(role)}` : ''

// Marks drafts that match the user's applications (same link or same company and role) or an earlier row in the file.
export function markDuplicates(drafts, existing) {
  const known = new Map()
  for (const application of existing) {
    for (const key of [linkKey(application.link), nameKey(application.company, application.role)]) {
      if (key && !known.has(key))
        known.set(key, { company: application.company, role: application.role, inFile: false })
    }
  }
  return drafts.map((draft) => {
    const keys = [linkKey(draft.fields.link), nameKey(draft.fields.company, draft.fields.role)].filter(Boolean)
    const match = keys.map((key) => known.get(key)).find(Boolean) || null
    for (const key of keys)
      if (!known.has(key)) known.set(key, { company: draft.fields.company, role: draft.fields.role, inFile: true })
    return { ...draft, duplicate: match }
  })
}
