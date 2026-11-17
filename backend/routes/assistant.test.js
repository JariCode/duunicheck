// Run with: node --test (in the backend folder)
// The /assistant/suggest route with a mocked OpenAI client, database models and Clerk: no network.
import assert from 'node:assert/strict'
import { after, before, test, mock } from 'node:test'
import express from 'express'
import OpenAI from 'openai'
import { clerkClient } from '@clerk/express'
import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { Cv } from '../models/Cv.js'
import { Template } from '../models/Template.js'
import { assistant, cvContextText, helsinkiDate } from './assistant.js'

const userId = 'a'.repeat(24)
const applicationId = 'b'.repeat(24)
const cvId = 'c'.repeat(24)

const cv = {
  _id: cvId,
  userId,
  fullName: 'Matti Meikäläinen',
  email: 'matti.meikalainen@example.com',
  phone: '+358 40 123 4567',
  linkedin: 'https://www.linkedin.com/in/matti-meikalainen',
  github: 'https://github.com/mattimeikalainen',
  portfolio: 'https://portfolio.example.com/matti',
  website: 'https://www.mattimeikalainen.example',
  photo: 'data:image/png;base64,AAAA',
  title: 'Ohjelmistokehittäjä',
  summary: 'Web-kehitykseen suuntautunut ohjelmistokehittäjä.',
  skills: 'JavaScript\nReact',
  experience: 'Kehittäjä, Esimerkki Oy (2024–)\nKäyttöliittymät ja rajapinnat.',
  education: 'Tieto- ja viestintätekniikan perustutkinto, valmistunut 17.9.2026',
  certificates: 'ISTQB Foundation Level\nScrum Master (PSM I)',
  courses: 'Relaatiotietokannat (8/2026)\nOhjelmistotestauksen perusteet (8/2026)',
  languages: 'Suomi – äidinkieli\nEnglanti – hyvä',
  hobbies: 'Kamppailulajit ja koiran kanssa ulkoilu',
}

let server
let baseUrl
let sent = []
let createMock
let clientOptions = null

before(async () => {
  process.env.OPENAI_API_KEY = 'test-key-not-used'
  createMock = mock.method(OpenAI.Responses.prototype, 'create', async function create(body) {
    sent.push(body)
    clientOptions = { timeout: this._client.timeout, maxRetries: this._client.maxRetries }
    return { status: 'completed', output_text: 'Ehdotus.' }
  })
  mock.method(Application, 'findOne', () => ({
    lean: async () => ({ _id: applicationId, userId, role: 'Frontend-kehittäjä', company: 'Esimerkki Oy', cvId }),
  }))
  mock.method(Cv, 'findOne', () => ({ lean: async () => cv }))
  mock.method(Cv, 'find', () => ({ select: () => ({ lean: async () => [cv] }) }))
  mock.method(Template, 'find', () => ({ select: () => ({ lean: async () => [] }) }))
  // clerkClient.users returns a new API object on each access, so its class method is mocked.
  mock.method(Object.getPrototypeOf(clerkClient.users), 'getUser', async () => ({
    firstName: 'Matti',
    lastName: 'Meikäläinen',
    emailAddresses: [{ emailAddress: cv.email }],
    phoneNumbers: [],
  }))
  mock.method(Conversation, 'findOneAndUpdate', async () => ({ _id: 'd'.repeat(24) }))
  mock.method(ConversationMessage, 'insertMany', async () => [])

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.userId = 'user_test'
    req.dbUserId = userId
    next()
  })
  app.use('/assistant', assistant)
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server?.close()
  mock.restoreAll()
})

const postingText = 'Edellytämme kielitaitoa ja testauskursseja.'
const userMessage = 'Vertaa CV:tä ilmoitukseen.'

function postSuggest() {
  return fetch(`${baseUrl}/assistant/suggest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      context: { applicationId, includePosting: true, postingText, includeCv: true, allowSuggestions: true },
    }),
  })
}

async function suggest() {
  sent = []
  const response = await fetch(`${baseUrl}/assistant/suggest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Vertaa CV:tä ilmoitukseen.',
      context: {
        applicationId,
        includePosting: true,
        postingText: 'Edellytämme kielitaitoa ja testauskursseja.',
        includeCv: true,
        allowSuggestions: true,
      },
    }),
  })
  assert.equal(response.status, 200)
  assert.equal(sent.length, 1)
  return sent[0]
}

test('sends courses, certificates and languages from the CV under their headings', async () => {
  const { input } = await suggest()
  assert.match(input, /Kurssit:\nRelaatiotietokannat \(8\/2026\)\nOhjelmistotestauksen perusteet \(8\/2026\)/u)
  assert.match(input, /Sertifikaatit:\nISTQB Foundation Level\nScrum Master \(PSM I\)/u)
  assert.match(input, /Kielitaito:\nSuomi – äidinkieli\nEnglanti – hyvä/u)
  assert.match(input, /Ammattinimike: Ohjelmistokehittäjä/u)
  assert.match(input, /Profiili: Web-kehitykseen suuntautunut ohjelmistokehittäjä\./u)
  assert.match(input, /IT-taidot:\nJavaScript\nReact/u)
  assert.match(input, /Työkokemus:\nKehittäjä, Esimerkki Oy/u)
  assert.match(input, /Koulutus: Tieto- ja viestintätekniikan perustutkinto, valmistunut 17\.9\.2026/u)
})

test('does not send the name, contact details, links, hobbies or photo', async () => {
  const { input, instructions } = await suggest()
  for (const value of [
    'Matti',
    'Meikäläinen',
    cv.email,
    cv.phone,
    'linkedin.com',
    'github.com',
    'portfolio.example.com',
    'mattimeikalainen.example',
    'Kamppailulajit',
    'Harrastukset',
    'data:image',
  ]) {
    assert.ok(!input.includes(value), `input contains ${value}`)
    assert.ok(!instructions.includes(value), `instructions contain ${value}`)
  }
})

test("tells the model today's date in Helsinki time", async () => {
  const { instructions } = await suggest()
  const today = new Intl.DateTimeFormat('fi-FI', {
    timeZone: 'Europe/Helsinki',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date())
  assert.ok(instructions.includes(`Tänään on ${today}.`), instructions)
  assert.match(instructions, /mennyt valmistumispäivä tarkoittaa, että tutkinto on suoritettu/u)
})

test('helsinkiDate uses the Finnish day, also when UTC is still on the previous day', () => {
  // 23:30 UTC on 16 November is 01:30 on 17 November in Helsinki.
  assert.equal(helsinkiDate(new Date('2026-11-16T23:30:00Z')), '17.11.2026')
  assert.equal(helsinkiDate(new Date('2026-06-30T21:30:00Z')), '1.7.2026')
})

test('cvContextText leaves out empty fields', () => {
  assert.equal(cvContextText({ title: 'Kehittäjä', summary: '  ', courses: 'Kurssi A' }), 'Ammattinimike: Kehittäjä\n\nKurssit: Kurssi A')
  assert.equal(cvContextText({ fullName: 'Matti Meikäläinen', hobbies: 'Suunnistus' }), '')
})

test('suggestions wait up to 120 s for OpenAI and are not retried', async () => {
  await suggest()
  assert.deepEqual(clientOptions, { timeout: 120_000, maxRetries: 0 })
})

test('a timed-out OpenAI request returns 504 with a Finnish message and logs only the error name', async () => {
  createMock.mock.mockImplementationOnce(async () => {
    throw new OpenAI.APIConnectionTimeoutError()
  })
  const logged = mock.method(console, 'error', () => {})
  try {
    const response = await postSuggest()
    assert.equal(response.status, 504)
    const body = await response.json()
    assert.match(body.error, /^AI-vastaus kesti liian kauan\. Yritä uudelleen tai pyydä lyhyempi vastaus/u)
    const calls = logged.mock.calls.filter((call) => call.arguments[0] === 'OpenAI assistant request failed')
    assert.equal(calls.length, 1)
    const details = calls[0].arguments[1]
    assert.equal(details.name, 'APIConnectionTimeoutError')
    const text = JSON.stringify(logged.mock.calls.map((call) => call.arguments))
    for (const content of [userMessage, postingText, 'Request timed out', 'Relaatiotietokannat', cv.email]) {
      assert.ok(!text.includes(content), `log contains ${content}`)
    }
  } finally {
    logged.mock.restore()
  }
})

test('other connection errors still return 502 and log their own name', async () => {
  createMock.mock.mockImplementationOnce(async () => {
    throw new OpenAI.APIConnectionError({ message: 'socket hang up' })
  })
  const logged = mock.method(console, 'error', () => {})
  try {
    const response = await postSuggest()
    assert.equal(response.status, 502)
    const details = logged.mock.calls.find((call) => call.arguments[0] === 'OpenAI assistant request failed').arguments[1]
    assert.equal(details.name, 'APIConnectionError')
    assert.ok(!JSON.stringify(logged.mock.calls.map((call) => call.arguments)).includes('socket hang up'))
  } finally {
    logged.mock.restore()
  }
})
