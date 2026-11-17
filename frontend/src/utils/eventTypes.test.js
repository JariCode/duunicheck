// Run with: node --test src/utils (in the frontend folder)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eventTypes, sentTypes } from '../utils.js'

test('"Hakemus jätetty" is no longer offered for new events, "Lähetetty" is', () => {
  assert.ok(!eventTypes.includes('Hakemus jätetty'))
  assert.ok(eventTypes.includes('Lähetetty'))
  assert.equal(new Set(eventTypes).size, eventTypes.length)
})

test('an old "Hakemus jätetty" event still counts as sent', () => {
  assert.ok(sentTypes.includes('Hakemus jätetty'))
  assert.ok(sentTypes.includes('Lähetetty'))
  // The dashboard's send date (DashboardStats getSentDate) finds the old event like a new one.
  const events = [
    { type: 'Hakemus jätetty', date: '2026-10-02' },
    { type: 'Vastaus saatu', date: '2026-10-09' },
  ]
  assert.equal(events.find((event) => sentTypes.includes(event.type))?.date, '2026-10-02')
})
