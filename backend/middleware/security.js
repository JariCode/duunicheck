import { getAuth } from '@clerk/express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

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

export function requireUser(req, res, next) {
  const auth = getAuth(req)
  if (!auth.isAuthenticated || !auth.userId) {
    return res.status(401).json({ error: 'Kirjautuminen vaaditaan.' })
  }
  req.userId = auth.userId
  return next()
}
