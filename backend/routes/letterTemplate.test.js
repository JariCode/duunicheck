// Run with: node --test (in the backend folder)
// Saving an AI cover letter as a new template: POST /templates and PATCH /applications/:id/template
// with mocked models (no database). The template data is built with the app's own letterTemplate().
import assert from 'node:assert/strict'
import { after, before, beforeEach, mock, test } from 'node:test'
import express from 'express'
import { Application } from '../models/Application.js'
import { Template } from '../models/Template.js'
import { applications } from './applications.js'
import { templates } from './templates.js'
import { letterTemplate } from '../../frontend/src/utils/letterTemplate.js'

const userId = 'a'.repeat(24)
const otherUserId = 'f'.repeat(24)
const ownApplicationId = 'b'.repeat(24)
const otherUsersApplicationId = 'c'.repeat(24)
const applicationWithFileId = 'd'.repeat(24)
const oldTemplateId = '1'.repeat(24)
const newTemplateId = '2'.repeat(24)
const otherUsersTemplateId = '3'.repeat(24)

const oldTemplate = {
  id: oldTemplateId,
  name: 'Esimerkki Oy · Frontend-kehittäjä (AI 17.11.2026)',
  fullName: 'Matti Meikäläinen',
  email: 'matti.meikalainen@example.com',
  phone: '+358 40 123 4567',
  body: 'Hei,\n\nVanha kirje.\n\nTerveisin,\n{{nimi}}',
  linkedin: 'https://www.linkedin.com/in/matti-meikalainen',
  github: '',
  portfolio: '',
  website: '',
}
const applicationsInDb = [
  {
    _id: ownApplicationId,
    userId,
    company: 'Esimerkki Oy',
    role: 'Frontend-kehittäjä',
    templateId: oldTemplateId,
    applicationText: 'Alkuperäinen hakemusteksti',
    applicationFileIds: [],
  },
  { _id: otherUsersApplicationId, userId: otherUserId, company: 'Toinen Oy', role: 'Testaaja', applicationFileIds: [] },
  {
    _id: applicationWithFileId,
    userId,
    company: 'Tiedosto Oy',
    role: 'Kehittäjä',
    applicationFileIds: ['4'.repeat(24)],
  },
]
const ownTemplates = [
  { _id: oldTemplateId, userId },
  { _id: newTemplateId, userId },
  { _id: otherUsersTemplateId, userId: otherUserId },
]
const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value))
const asDocument = (value) => ({ toObject: () => ({ ...value }) })

let server
let baseUrl
let templateCount
let created
let applicationUpdates
const forbidden = []

before(async () => {
  mock.method(Template, 'countDocuments', async () => templateCount)
  mock.method(Template, 'create', async (data) => {
    created.push(data)
    return asDocument({ ...data, _id: newTemplateId })
  })
  mock.method(Template, 'exists', (filter) => Promise.resolve(ownTemplates.some((item) => matches(item, filter))))
  // Nothing may change or delete an existing template.
  for (const method of ['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne', 'findOneAndDelete', 'deleteOne', 'deleteMany']) {
    mock.method(Template, method, () => {
      forbidden.push(`Template.${method}`)
      throw new Error('not allowed')
    })
  }
  mock.method(Application, 'findOne', (filter) => {
    const found = applicationsInDb.find((item) => matches(item, filter)) || null
    return { select: () => ({ lean: async () => found }), lean: async () => found }
  })
  mock.method(Application, 'findOneAndUpdate', async (filter, update) => {
    applicationUpdates.push({ filter, update })
    const found = applicationsInDb.find((item) => matches(item, filter))
    return found ? asDocument({ ...found, ...update.$set }) : null
  })
  for (const method of ['updateOne', 'updateMany', 'replaceOne']) {
    mock.method(Application, method, () => {
      forbidden.push(`Application.${method}`)
      throw new Error('not allowed')
    })
  }

  const app = express()
  app.use(express.json({ limit: '1mb' }))
  app.use((req, _res, next) => {
    req.dbUserId = userId
    next()
  })
  app.use('/templates', templates)
  app.use('/applications', applications)
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  templateCount = 1
  created = []
  applicationUpdates = []
  forbidden.length = 0
})

after(() => {
  server?.close()
  mock.restoreAll()
})

const request = (method, path, body) =>
  fetch(`${baseUrl}${path}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const job = { id: ownApplicationId, company: 'Esimerkki Oy', role: 'Frontend-kehittäjä', templateId: oldTemplateId }
const letter = 'Hei,\n\nHaen tehtävää.\n\nYstävällisin terveisin,\n[Nimesi]\n[Yhteystietosi]'
const date = new Date('2026-11-17T10:00:00Z')

test('saving creates a new template and changes no existing template', async () => {
  const before = structuredClone(oldTemplate)
  const draft = letterTemplate({ job, letter, templates: [oldTemplate], cvs: [], date })
  const response = await request('POST', '/templates', draft)
  assert.equal(response.status, 201)
  assert.equal(created.length, 1)
  assert.equal(String(created[0].userId), userId)
  assert.equal(created[0].body, 'Hei,\n\nHaen tehtävää.\n\nYstävällisin terveisin,\n{{nimi}}')
  assert.equal(created[0].fullName, 'Matti Meikäläinen')
  assert.equal(created[0].email, 'matti.meikalainen@example.com')
  assert.deepEqual(forbidden, [])
  assert.deepEqual(oldTemplate, before)
})

test('the name gets a number when a template already has it', async () => {
  const draft = letterTemplate({ job, letter, templates: [oldTemplate], cvs: [], date })
  assert.equal(draft.name, `${oldTemplate.name} 2`)
  await request('POST', '/templates', draft)
  assert.equal(created[0].name, `${oldTemplate.name} 2`)
  const third = letterTemplate({ job, letter, templates: [oldTemplate, { name: `${oldTemplate.name} 2` }], cvs: [], date })
  assert.equal(third.name, `${oldTemplate.name} 3`)
})

test('a letter over 20 000 characters is rejected', async () => {
  const draft = letterTemplate({ job, letter: 'x'.repeat(20_001), templates: [], cvs: [], date })
  const response = await request('POST', '/templates', draft)
  assert.equal(response.status, 400)
  assert.equal(created.length, 0)
})

test('the 100 template limit applies', async () => {
  templateCount = 100
  const response = await request('POST', '/templates', letterTemplate({ job, letter, templates: [], cvs: [], date }))
  assert.equal(response.status, 413)
  assert.equal(created.length, 0)
})

test("using the letter changes only the application's template id, not its text, files or the old template", async () => {
  const response = await request('PATCH', `/applications/${ownApplicationId}/template`, { templateId: newTemplateId })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).templateId, newTemplateId)
  assert.equal(applicationUpdates.length, 1)
  assert.deepEqual(applicationUpdates[0].update, { $set: { templateId: newTemplateId } })
  assert.equal(String(applicationUpdates[0].filter.userId), userId)
  assert.equal(applicationsInDb[0].applicationText, 'Alkuperäinen hakemusteksti')
  assert.deepEqual(forbidden, [])
})

test("another user's application cannot get the letter", async () => {
  const response = await request('PATCH', `/applications/${otherUsersApplicationId}/template`, { templateId: newTemplateId })
  assert.equal(response.status, 404)
  assert.equal(applicationUpdates.length, 0)
})

test("another user's template cannot be used, and only a template id is accepted", async () => {
  let response = await request('PATCH', `/applications/${ownApplicationId}/template`, { templateId: otherUsersTemplateId })
  assert.equal(response.status, 400)
  response = await request('PATCH', `/applications/${ownApplicationId}/template`, {
    templateId: newTemplateId,
    applicationText: 'Ylikirjoitus',
  })
  assert.equal(response.status, 400)
  assert.equal(applicationUpdates.length, 0)
})

test('an application with an attached cover letter file keeps it and gets no template', async () => {
  const response = await request('PATCH', `/applications/${applicationWithFileId}/template`, { templateId: newTemplateId })
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /hakukirjetiedosto/u)
  assert.equal(applicationUpdates.length, 0)
})
