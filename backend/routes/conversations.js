import { Router } from 'express'
import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { localAnswerSchema, mongoIdParam, parseBody } from '../utils/sanitize.js'

export const conversations = Router()

function displayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || 'Ei tiedossa'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('fi-FI').format(new Date(year, month - 1, day))
}

function buildApplicationAnswer(application, message) {
  const lowerMessage = message.toLocaleLowerCase('fi-FI')
  const events = [...(application.events || [])].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  const askedForHistory = /(historia|tapahtum|haastattel|vastaus|vastannut)/i.test(lowerMessage)
  const askedForNotes = /(muistiinpano|muistiinpanot|merkintä|merkinnät)/i.test(lowerMessage)
  const lines = [
    `${application.role} · ${application.company}`,
    `Tila: ${application.status}`,
    `Lähetyspäivä: ${displayDate(application.added)}`,
    `Vastauspäivä: ${displayDate(application.respondedAt)}`,
    `Sijainti: ${application.place || 'Ei tallennettu'}`,
    `Ilmoitus: ${application.link || 'Ei linkkiä tallennettu'}`,
    `Seuraava tehtävä: ${application.next || 'Ei määritetty'}`,
    `Muistutuspäivä: ${displayDate(application.nextDate)}`,
  ]
  if (askedForHistory) lines.push(`Tapahtumahistoria:\n${events.length ? events.map((event) => `• ${displayDate(event.date)} · ${event.type}${event.note ? ` — ${event.note}` : ''}`).join('\n') : 'Ei kirjattuja tapahtumia.'}`)
  if (askedForNotes) lines.push(`Muistiinpanot: ${application.notes || application.applicationText || 'Ei muistiinpanoja.'}`)
  return lines.join('\n')
}

async function saveConversationPair({ userId, applicationId, question, answer }) {
  const filter = { userId, applicationId }
  let conversation
  try {
    conversation = await Conversation.findOneAndUpdate(filter, { $setOnInsert: filter }, { upsert: true, returnDocument: 'after', runValidators: true })
  } catch (error) {
    if (error?.code !== 11000) throw error
    conversation = await Conversation.findOne(filter)
    if (!conversation) throw error
  }
  await ConversationMessage.insertMany([
    { userId, conversationId: conversation._id, role: 'user', content: question },
    { userId, conversationId: conversation._id, role: 'assistant', content: answer },
  ])
}

conversations.post('/:applicationId/answer', async (req, res) => {
  if (!mongoIdParam(req.params.applicationId)) return res.status(400).json({ error: 'Virheellinen hakemuksen tunniste.' })
  const parsed = parseBody(localAnswerSchema, req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Kirjoita kysymys hakemuksen tiedoista.' })
  const application = await Application.findOne({ _id: req.params.applicationId, userId: req.dbUserId }).lean()
  if (!application) return res.status(404).json({ error: 'Hakemusta ei löytynyt.' })

  const answer = buildApplicationAnswer(application, parsed.data.message)
  await saveConversationPair({ userId: req.dbUserId, applicationId: application._id, question: parsed.data.message, answer })
  return res.json({ answer })
})

conversations.get('/:applicationId', async (req, res) => {
  if (!mongoIdParam(req.params.applicationId)) return res.status(400).json({ error: 'Virheellinen hakemuksen tunniste.' })

  const application = await Application.findOne({ _id: req.params.applicationId, userId: req.dbUserId }).select('_id').lean()
  if (!application) return res.status(404).json({ error: 'Hakemusta ei löytynyt.' })

  const conversation = await Conversation.findOne({ userId: req.dbUserId, applicationId: application._id }).select('_id').lean()
  if (!conversation) return res.json({ messages: [] })

  const messages = await ConversationMessage.find({ userId: req.dbUserId, conversationId: conversation._id })
    .sort({ createdAt: 1, _id: 1 }).lean()
  return res.json({ messages: messages.map((message) => ({
    id: String(message._id),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  })) })
})
