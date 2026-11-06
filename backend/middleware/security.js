import { getAuth } from '@clerk/express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { User } from '../models/User.js'

// Limits can be raised for automated test runs with environment variables. Without them the
// production values below are used.
const limitFromEnv = (name, fallback) => {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

// apiLimiter runs before requireUser, so req.userId is not set yet. In @clerk/express 2.x
// req.auth is a function, so the user id must be read with getAuth().
const userOrIp = (req) => req.userId || getAuth(req).userId || ipKeyGenerator(req.ip)

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitFromEnv('RATE_LIMIT_API', 120),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIp,
  message: { error: 'Liikaa pyyntöjä. Yritä hetken kuluttua uudelleen.' },
})

// Webhooks are not authenticated with a Clerk user session, so limit them by
// the source IP. The request body remains untouched for Svix verification.
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: limitFromEnv('RATE_LIMIT_WEBHOOK', 120),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'Webhook-pyyntöjä tuli liian monta. Yritä hetken kuluttua uudelleen.' },
})

export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: limitFromEnv('RATE_LIMIT_UPLOAD', 30),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIp,
  message: { error: 'Tiedostojen tuntikohtainen latausraja tuli vastaan.' },
})

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: limitFromEnv('RATE_LIMIT_AI', 20),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIp,
  message: { error: 'AI-pyyntöjen tuntikohtainen raja tuli vastaan.' },
})

export async function requireUser(req, res, next) {
  const auth = getAuth(req)
  if (!auth.isAuthenticated || !auth.userId) {
    return res.status(401).json({ error: 'Kirjautuminen vaaditaan.' })
  }
  try {
    const user = await User.findOneAndUpdate(
      { clerkId: auth.userId },
      { $setOnInsert: { clerkId: auth.userId } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )
    req.userId = auth.userId
    req.dbUserId = user._id
    return next()
  } catch (error) {
    // A concurrent first request can race the unique Clerk ID index. In that
    // case, load the row created by the winning request and continue safely.
    if (error?.code === 11000) {
      try {
        const user = await User.findOne({ clerkId: auth.userId }).select('_id').lean()
        if (user) {
          req.userId = auth.userId
          req.dbUserId = user._id
          return next()
        }
      } catch (lookupError) {
        return next(lookupError)
      }
    }
    return next(error)
  }
}
