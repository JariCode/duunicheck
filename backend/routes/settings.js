import { Router } from 'express'
import { z } from 'zod'
import { User } from '../models/User.js'

const router = Router()
const themeSettings = z.object({ theme: z.enum(['default', 'dark', 'light']) }).strict()

router.get('/', async (req, res) => {
  const user = await User.findById(req.dbUserId).select('theme').lean()
  return res.json({ theme: user?.theme || 'default' })
})

router.put('/', async (req, res) => {
  const result = themeSettings.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: 'Valitse käytettävissä oleva teema.' })
  const user = await User.findOneAndUpdate(
    { _id: req.dbUserId },
    { $set: { theme: result.data.theme } },
    { returnDocument: 'after', runValidators: true, strict: 'throw' },
  ).select('theme').lean()
  if (!user) return res.status(404).json({ error: 'Käyttäjätiliä ei löytynyt.' })
  return res.json({ theme: user.theme })
})

export const settings = router
