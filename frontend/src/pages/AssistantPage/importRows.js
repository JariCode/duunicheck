import { safeHttpUrl, stages } from '../../utils'

// Shared by the assistant page and the import message: file checks, row state and duplicate matching.
export const importAccept = '.xlsx,.csv,.docx,.pdf,.txt'
export const maxImportFileSize = 5 * 1024 * 1024

const isDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value)
const normalize = (value) =>
  String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export function checkImportFile(file) {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!importAccept.split(',').includes(extension))
    return 'Sallittuja tiedostomuotoja ovat Excel (.xlsx), CSV, Word (.docx), PDF ja TXT.'
  if (file.size > maxImportFileSize) return 'Tiedoston koko ylittää 5 Mt:n rajan.'
  return ''
}

export function rowSavable(row) {
  const { fields } = row
  return (
    !row.saved &&
    Boolean(fields.company.trim() && fields.role.trim()) &&
    stages.includes(fields.status) &&
    (!fields.link.trim() || Boolean(safeHttpUrl(fields.link.trim()))) &&
    [fields.added, fields.respondedAt, fields.nextDate, ...fields.events.map((event) => event.date)].every(isDate)
  )
}

// Duplicates, rows needing review and incomplete rows start unselected; at most `capacity` rows are preselected.
export function buildImportRows(applications, capacity, savedKeys = []) {
  let free = Math.max(0, capacity - savedKeys.length)
  return applications.map((application) => {
    const saved = savedKeys.includes(application.key)
    const row = {
      ...application,
      fields: { ...application.fields, events: application.fields.events.map((event) => ({ ...event })) },
      saved,
      open: false,
      selected: false,
    }
    if (!saved && !row.duplicate && !row.review && !row.incomplete && rowSavable(row) && free > 0) {
      row.selected = true
      free -= 1
    }
    return row
  })
}

// Same rule as the server: same link, or same company and role among the user's applications.
export function findExisting(fields, jobs) {
  const link = safeHttpUrl(fields.link.trim())
  const company = normalize(fields.company)
  const role = normalize(fields.role)
  const match = jobs.find(
    (job) =>
      (link && safeHttpUrl(String(job.link || '').trim()) === link) ||
      (company && role && normalize(job.company) === company && normalize(job.role) === role),
  )
  return match ? { company: match.company, role: match.role, inFile: false } : null
}
