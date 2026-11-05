import express, { Router } from 'express'
import mongoose from 'mongoose'
import { verifyWebhook } from '@clerk/express/webhooks'
import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { Cv } from '../models/Cv.js'
import { Template } from '../models/Template.js'
import { User } from '../models/User.js'
import { FileAsset } from '../models/FileAsset.js'

async function removeUserAndData(clerkId) {
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ clerkId }).select('_id').session(session)
      if (!user) return

      const userId = user._id
      await Application.deleteMany({ userId }, { session })
      await Cv.deleteMany({ userId }, { session })
      await Template.deleteMany({ userId }, { session })
      await FileAsset.deleteMany({ userId }, { session })
      await ConversationMessage.deleteMany({ userId }, { session })
      await Conversation.deleteMany({ userId }, { session })
      await User.deleteOne({ _id: userId }, { session })
    })
  } finally {
    await session.endSession()
  }
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
