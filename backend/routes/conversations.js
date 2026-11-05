import { Router } from 'express'
import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { mongoIdParam } from '../utils/sanitize.js'

export const conversations = Router()

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
