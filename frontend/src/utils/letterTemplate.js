// Turns an AI cover letter into a new cover letter template. Everything here runs in the app only:
// the name and contact details copied into the template never go to OpenAI.

// Template.name and Template.body limits (backend/models/Template.js).
export const maxTemplateNameLength = 120
export const maxTemplateBodyLength = 20000
// The most templates a user can have (backend/routes/templates.js).
export const maxTemplates = 100

const contactFields = ['fullName', 'email', 'phone', 'linkedin', 'github', 'portfolio', 'website']

// Today in Finland as pp.kk.vvvv.
export function helsinkiDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('fi-FI', {
    timeZone: 'Europe/Helsinki',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

// "<company> · <role> (AI pp.kk.vvvv)", shortened to the name limit. If a template already has the
// name, " 2", " 3" and so on is added.
export function letterTemplateName(job, existingNames, date = new Date()) {
  const taken = new Set(existingNames)
  const base = [job?.company, job?.role].map((value) => String(value || '').trim()).filter(Boolean).join(' · ')
  const label = `(AI ${helsinkiDateLabel(date)})`
  for (let number = 1; ; number += 1) {
    const ending = `${label}${number > 1 ? ` ${number}` : ''}`
    const room = maxTemplateNameLength - ending.length - 1
    const start = base.length > room ? base.slice(0, room).trimEnd() : base
    const name = start ? `${start} ${ending}` : ending
    if (!taken.has(name)) return name
  }
}

// The print and PDF show the template's name, email and phone in the letter's header and its links
// at the bottom, and fill {{nimi}} with the template's name. So the signature keeps the name as
// {{nimi}}, and [Yhteystietosi] is removed so the contact details are not printed twice.
export function prepareLetterBody(letter) {
  return String(letter || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '[Yhteystietosi]')
    .map((line) =>
      line
        .replaceAll('[Nimesi]', '{{nimi}}')
        .replaceAll('[Yhteystietosi]', '')
        .replace(/[ \t]+$/u, ''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Places the user still has to fill in, such as "[Kuvaa…]" or "[Täydennä…]".
export function pendingPlaceholders(text) {
  return (String(text || '').match(/\[[^[\]\n]{2,200}\]/gu) || []).filter(
    (match) => match !== '[Nimesi]' && match !== '[Yhteystietosi]',
  )
}

// Name, contact details and links for the new template: from the application's current template if
// it has one, otherwise from the application's app CV.
export function letterContactDetails(job, templates, cvs) {
  const source =
    templates.find((item) => item.id === job?.templateId) || cvs.find((item) => item.id === job?.cvId) || {}
  return Object.fromEntries(contactFields.map((field) => [field, String(source[field] || '')]))
}

// The new template as POST /templates expects it.
export function letterTemplate({ job, letter, templates, cvs, date = new Date() }) {
  return {
    name: letterTemplateName(
      job,
      templates.map((item) => item.name),
      date,
    ),
    ...letterContactDetails(job, templates, cvs),
    body: prepareLetterBody(letter),
  }
}
