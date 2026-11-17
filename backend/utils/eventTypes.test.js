// Run with: node --test (in the backend folder)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { finalizeDraft, importEventTypes } from './importApplications.js'
import { applicationSchema } from './sanitize.js'

const application = {
  company: 'Esimerkki Oy',
  role: 'Frontend-kehittäjä',
  status: 'Lähetetty',
  added: '2026-10-02',
  events: [
    { id: 1, type: 'Hakemus jätetty', date: '2026-10-02', note: '' },
    { id: 2, type: 'Vastaus saatu', date: '2026-10-09', note: '' },
  ],
}

test('an application with an old "Hakemus jätetty" event can still be saved', () => {
  const result = applicationSchema.safeParse(application)
  assert.equal(result.success, true)
  assert.equal(result.data.events[0].type, 'Hakemus jätetty')
})

test('the AI import offers only "Lähetetty" for a sent application', () => {
  assert.ok(!importEventTypes.includes('Hakemus jätetty'))
  assert.ok(importEventTypes.includes('Lähetetty'))
})

test('an imported draft keeps an old event type as it is', () => {
  const { fields } = finalizeDraft({ fields: application })
  assert.deepEqual(
    fields.events.map((event) => event.type),
    ['Hakemus jätetty', 'Vastaus saatu'],
  )
})
