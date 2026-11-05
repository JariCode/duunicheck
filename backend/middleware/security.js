import { getAuth } from '@clerk/express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { User } from '../models/User.js'

const userOrIp = (req) => req.userId || req.auth?.userId || ipKeyGenerator(req.ip)

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIp,
  message: { error: 'Liikaa pyyntöjä. Yritä hetken kuluttua uudelleen.' },
})

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
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
