import express, { Router } from 'express'
import { verifyWebhook } from '@clerk/express/webhooks'
import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { Cv } from '../models/Cv.js'
import { Template } from '../models/Template.js'
import { User } from '../models/User.js'
import { FileAsset } from '../models/FileAsset.js'

async function removeUserAndData(clerkId) {
  const user = await User.findOne({ clerkId }).select('_id').lean()
  if (!user) return

  // Clerk/Svix retries a delivery when it does not receive a 2xx response.
  // These owner-scoped deletes are idempotent, so execute them concurrently
  // and remove the user row only after every collection has been cleaned.
  // This avoids a multi-collection transaction delaying the webhook response.
  const userId = user._id
  await Promise.all([
    Application.deleteMany({ userId }),
    Cv.deleteMany({ userId }),
    Template.deleteMany({ userId }),
    FileAsset.deleteMany({ userId }),
    ConversationMessage.deleteMany({ userId }),
    Conversation.deleteMany({ userId }),
  ])
  await User.deleteOne({ _id: userId })
}

export function createClerkWebhookRouter({ signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET } = {}) {
  const router = Router()

  router.post('/', express.raw({ type: 'application/json', limit: '64kb' }), async (req, res, next) => {
    if (!signingSecret) return res.status(503).json({ error: 'Webhookin allekirjoitusavainta ei ole määritetty.' })

    let event
    try {
      event = await verifyWebhook(req, { signingSecret })
    } catch {
      return res.status(400).json({ error: 'Webhookin allekirjoitusta ei voitu vahvistaa.' })
    }

    // This endpoint only needs deletion events. Other verified events are
    // acknowledged without storing extra profile information.
    if (event.type !== 'user.deleted') return res.status(204).end()
    const clerkId = event.data?.id
    if (typeof clerkId !== 'string' || !/^user_[A-Za-z0-9]+$/.test(clerkId)) {
      return res.status(400).json({ error: 'Poistotapahtumasta puuttui kelvollinen käyttäjätunniste.' })
    }

    try {
      await removeUserAndData(clerkId)
      return res.status(204).end()
    } catch (error) {
      return next(error)
    }
  })

  return router
}

export const clerkWebhook = createClerkWebhookRouter()
