// Run with: node --test src/utils (in the frontend folder)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  letterContactDetails,
  letterTemplate,
  letterTemplateName,
  maxTemplateNameLength,
  pendingPlaceholders,
  prepareLetterBody,
} from './letterTemplate.js'

const date = new Date('2026-11-17T10:00:00Z')
const job = { id: 'j1', company: 'Esimerkki Oy', role: 'Frontend-kehittäjä', templateId: '', cvId: 'cv1' }

test('names the template by company, role and the Finnish date', () => {
  assert.equal(letterTemplateName(job, [], date), 'Esimerkki Oy · Frontend-kehittäjä (AI 17.11.2026)')
  // 23:30 UTC is already the next day in Helsinki.
  assert.equal(letterTemplateName(job, [], new Date('2026-06-30T21:30:00Z')), 'Esimerkki Oy · Frontend-kehittäjä (AI 01.07.2026)')
})

test('adds a number when the name is taken', () => {
  const first = 'Esimerkki Oy · Frontend-kehittäjä (AI 17.11.2026)'
  assert.equal(letterTemplateName(job, [first], date), `${first} 2`)
  assert.equal(letterTemplateName(job, [first, `${first} 2`], date), `${first} 3`)
})

test('shortens a long name to the template name limit, keeping the date and number', () => {
  const long = { company: 'Hyvin Pitkänimisen Esimerkkiyrityksen Tytäryhtiö Oy'.repeat(2), role: 'Ohjelmistokehittäjä'.repeat(3) }
  const name = letterTemplateName(long, [], date)
  assert.ok(name.length <= maxTemplateNameLength, name)
  assert.ok(name.endsWith('(AI 17.11.2026)'))
  const second = letterTemplateName(long, [name], date)
  assert.ok(second.length <= maxTemplateNameLength && second.endsWith('(AI 17.11.2026) 2'), second)
})

test('keeps the name as {{nimi}} and removes the contact line, which the print adds from the template', () => {
  const letter = 'Hei,\n\nHaen tehtävää.\n\nYstävällisin terveisin,\n[Nimesi]\n[Yhteystietosi]\n'
  assert.equal(prepareLetterBody(letter), 'Hei,\n\nHaen tehtävää.\n\nYstävällisin terveisin,\n{{nimi}}')
  assert.equal(prepareLetterBody('Terveisin [Nimesi], [Yhteystietosi]'), 'Terveisin {{nimi}},')
})

test('counts the places left to fill in, but not the name and contact markers', () => {
  const text = 'Hei,\n[Kuvaa kokemuksesi]\nYstävällisin terveisin,\n[Nimesi]\n[Yhteystietosi]\n[Täydennä päivämäärä]'
  assert.deepEqual(pendingPlaceholders(text), ['[Kuvaa kokemuksesi]', '[Täydennä päivämäärä]'])
  assert.deepEqual(pendingPlaceholders('Ei täydennettävää.'), [])
})

test('copies the contact details from the current template, otherwise from the app CV', () => {
  const templates = [
    { id: 't1', name: 'Vanha', fullName: 'Matti Meikäläinen', email: 'matti@example.com', phone: '040 123 4567', linkedin: '', github: '', portfolio: '', website: 'https://example.com' },
  ]
  const cvs = [{ id: 'cv1', fullName: 'Matti M.', email: 'cv@example.com', phone: '050 765 4321', linkedin: 'https://linkedin.example/matti' }]
  assert.deepEqual(letterContactDetails({ ...job, templateId: 't1' }, templates, cvs), {
    fullName: 'Matti Meikäläinen',
    email: 'matti@example.com',
    phone: '040 123 4567',
    linkedin: '',
    github: '',
    portfolio: '',
    website: 'https://example.com',
  })
  assert.equal(letterContactDetails(job, templates, cvs).email, 'cv@example.com')
  assert.equal(letterContactDetails({ ...job, cvId: '' }, [], []).fullName, '')
  const draft = letterTemplate({ job, letter: 'Hei,\n\nTerveisin,\n[Nimesi]', templates, cvs, date })
  assert.equal(draft.body, 'Hei,\n\nTerveisin,\n{{nimi}}')
  assert.equal(draft.fullName, 'Matti M.')
  assert.deepEqual(Object.keys(draft).sort(), ['body', 'email', 'fullName', 'github', 'linkedin', 'name', 'phone', 'portfolio', 'website'])
})
