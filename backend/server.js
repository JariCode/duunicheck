import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { clerkMiddleware } from '@clerk/express'
import { apiLimiter, requireUser } from './middleware/security.js'
import { resources } from './routes/resources.js'
import { assistant } from './routes/assistant.js'

const app = express()
const PORT = Number(process.env.PORT || 5000)
const origins = (process.env.ALLOWED_ORIGIN || process.env.CLIENT_URL || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean)

if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY || !process.env.MONGODB_URI || origins.length === 0) {
  throw new Error('Backendin asetuksista puuttuu pakollinen Clerk-, MongoDB- tai frontend-asetus.')
}

// Clerk must run before route and request-parsing middleware.
app.use(clerkMiddleware({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY, authorizedParties: origins }))
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0))
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
}))
app.use(express.json({ limit: '64kb', strict: true, type: 'application/json' }))
app.disable('x-powered-by')

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api', apiLimiter, requireUser)
app.use('/api', resources)
app.use('/api/assistant', assistant)

app.use((_req, res) => res.status(404).json({ error: 'Rajapintaa ei löytynyt.' }))
app.use((error, _req, res, _next) => {
  if (res.headersSent) return
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Pyyntö on liian suuri.' })
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'Virheellinen JSON-pyyntö.' })
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.StrictModeError) {
    return res.status(400).json({ error: 'Tietojen tallennus epäonnistui tarkistuksessa.' })
  }
  return res.status(500).json({ error: 'Palvelimella tapahtui virhe.' })
})

await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10_000,
  autoIndex: true,
})

const server = app.listen(PORT, () => console.log(`Backend käynnissä portissa ${PORT}.`))
server.requestTimeout = 30_000
server.headersTimeout = 15_000
server.keepAliveTimeout = 5_000
server.maxRequestsPerSocket = 100
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close()
    await mongoose.disconnect()
    process.exit(0)
  })
}
