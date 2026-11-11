import express, { Router } from 'express'
import { verifyWebhook } from '@clerk/express/webhooks'
import { ClerkDeletionJob } from '../models/ClerkDeletionJob.js'

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
    const svixId = req.get('svix-id')
    if (typeof svixId !== 'string' || svixId.length < 1 || svixId.length > 200) {
      return res.status(400).json({ error: 'Webhookista puuttui kelvollinen tapahtumatunniste.' })
    }

    try {
      await ClerkDeletionJob.updateOne(
        { svixId },
        {
          $setOnInsert: { svixId, clerkId, status: 'pending', attempts: 0, nextAttemptAt: new Date() },
        },
        { upsert: true, runValidators: true },
      )
      // The verified event is durably queued in MongoDB. Return immediately;
      // deletion continues in the worker and survives Render restarts.
      return res.status(202).json({ status: 'queued' })
    } catch (error) {
      // Duplicate deliveries race safely on the unique Svix event id.
      if (error?.code === 11000) return res.status(202).json({ status: 'queued' })
      return next(error)
    }
  })

  return router
}

export const clerkWebhook = createClerkWebhookRouter()
