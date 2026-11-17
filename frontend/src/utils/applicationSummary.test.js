// Run with: node --test src/utils (in the frontend folder)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applicationSummaryDocument, sentDate, summaryDate } from './applicationSummary.js'

const date = new Date('2026-11-17T10:00:00Z')
const full = {
  company: 'Esimerkki Oy',
  role: 'Frontend-kehittäjä',
  place: 'Helsinki',
  link: 'https://tyopaikat.example.com/ilmoitus/123',
  status: 'Haastattelu sovittu',
  added: '2026-10-02',
  respondedAt: '',
  next: 'Valmistele haastattelu',
  nextDate: '2026-11-20',
  cvId: 'cv1',
  cvFileId: '',
  templateId: 't1',
  applicationFileIds: ['f1', 'gone'],
  notes: 'Rivi 1\nRivi 2',
  events: [
    { id: 1, type: 'Lähetetty', date: '2026-10-02', note: '' },
    { id: 2, type: 'Vastaus saatu', date: '2026-10-09', note: 'Sähköposti' },
    { id: 3, type: 'Haastattelu sovittu', date: '2026-10-09', note: '' },
  ],
}
const cvs = [{ id: 'cv1', name: 'Matin CV' }]
const templates = [{ id: 't1', name: 'Oma pohja' }]
const files = [{ id: 'f1', name: 'hakukirje.pdf' }]

test('a full application has every section in order, with Finnish dates', () => {
  const summary = applicationSummaryDocument(full, { cvs, templates, files, date })
  assert.equal(summary.kind, 'applicationSummary')
  assert.equal(summary.title, 'Frontend-kehittäjä')
  assert.equal(summary.subtitle, 'Esimerkki Oy · Helsinki')
  assert.equal(summary.printed, 'Tulostettu 17.11.2026')
  assert.deepEqual(summary.facts, [
    { label: 'Yritys', value: 'Esimerkki Oy' },
    { label: 'Tehtävä', value: 'Frontend-kehittäjä' },
    { label: 'Sijainti', value: 'Helsinki' },
    { label: 'Ilmoituksen linkki', value: 'https://tyopaikat.example.com/ilmoitus/123', href: 'https://tyopaikat.example.com/ilmoitus/123' },
    { label: 'Vaihe', value: 'Haastattelu sovittu' },
    { label: 'Lähetyspäivä', value: '02.10.2026' },
    { label: 'Vastauspäivä', value: '09.10.2026' },
    { label: 'Seuraava tehtävä', value: 'Valmistele haastattelu' },
    { label: 'Muistutuspäivä', value: '20.11.2026' },
  ])
  assert.deepEqual(summary.attachments, [
    { label: 'Sovelluksen CV', value: 'Matin CV' },
    { label: 'Hakemuspohja', value: 'Oma pohja' },
    { label: 'Hakukirjetiedosto', value: 'hakukirje.pdf' },
    { missing: 'Tiedosto on poistettu' },
  ])
  // Newest first; on the same day the later added event first, like the details view.
  assert.deepEqual(
    summary.events.map((event) => [event.date, event.type, event.note]),
    [
      ['09.10.2026', 'Haastattelu sovittu', ''],
      ['09.10.2026', 'Vastaus saatu', 'Sähköposti'],
      ['02.10.2026', 'Lähetetty', ''],
    ],
  )
  assert.equal(summary.notes, 'Rivi 1\nRivi 2')
  assert.deepEqual(summary.job, { company: 'Esimerkki Oy', role: 'Frontend-kehittäjä' })
})

test('a minimal application leaves out empty values and sections', () => {
  const summary = applicationSummaryDocument(
    { company: 'Esimerkki Oy', role: 'Testaaja', status: 'Kiinnostava', added: '2026-11-17', events: [] },
    { date },
  )
  assert.deepEqual(
    summary.facts.map((fact) => fact.label),
    ['Yritys', 'Tehtävä', 'Vaihe'],
  )
  assert.equal(summary.subtitle, 'Esimerkki Oy')
  assert.deepEqual(summary.attachments, [])
  assert.deepEqual(summary.events, [])
  assert.equal(summary.notes, '')
})

test('deleted attachments are named like in the details view', () => {
  const summary = applicationSummaryDocument(
    { company: 'A', role: 'B', status: 'Lähetetty', cvId: 'old', cvFileId: 'gone', templateId: 'x', applicationFileIds: ['a', 'b'], events: [] },
    { date },
  )
  assert.deepEqual(summary.attachments, [
    { missing: 'CV on poistettu' },
    { missing: 'CV-tiedosto on poistettu' },
    { missing: 'Hakemuspohja on poistettu' },
    { missing: '2 tiedostoa on poistettu' },
  ])
})

test('the send date follows the dashboard: the sent event, otherwise the date while sent', () => {
  assert.equal(sentDate({ status: 'Lähetetty', added: '2026-10-05', events: [{ type: 'Hakemus jätetty', date: '2026-10-01' }] }), '2026-10-01')
  assert.equal(sentDate({ status: 'Lähetetty', added: '2026-10-05', events: [] }), '2026-10-05')
  assert.equal(sentDate({ status: 'Kiinnostava', added: '2026-10-05', events: [] }), '')
  assert.equal(summaryDate('2026-1-5'), '')
  assert.equal(summaryDate(''), '')
})

test('a link that is not http(s) is left out', () => {
  const summary = applicationSummaryDocument({ company: 'A', role: 'B', status: 'Kiinnostava', link: 'javascript:alert(1)', events: [] }, { date })
  assert.ok(!summary.facts.some((fact) => fact.label === 'Ilmoituksen linkki'))
})

test('an old application text kept apart from the notes gets a section of its own', () => {
  const summary = applicationSummaryDocument({ ...full, applicationText: '  Vanha teksti\nrivi 2 ' }, { cvs, templates, files, date })
  assert.equal(summary.notes, 'Rivi 1\nRivi 2')
  assert.equal(summary.applicationText, 'Vanha teksti\nrivi 2')
  assert.equal(applicationSummaryDocument(full, { date }).applicationText, '')
})
