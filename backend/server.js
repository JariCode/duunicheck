import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { clerkMiddleware } from '@clerk/express'
import { apiLimiter, requireUser, webhookLimiter } from './middleware/security.js'
import { Application } from './models/Application.js'
import { Conversation } from './models/Conversation.js'
import { ConversationMessage } from './models/ConversationMessage.js'
import { Cv } from './models/Cv.js'
import { Template } from './models/Template.js'
import { User } from './models/User.js'
import { FileAsset } from './models/FileAsset.js'
import { ClerkDeletionJob } from './models/ClerkDeletionJob.js'
import { startClerkDeletionWorker } from './services/clerkDeletionWorker.js'
import { applications } from './routes/applications.js'
import { assistant } from './routes/assistant.js'
import { clerkWebhook } from './routes/clerkWebhook.js'
import { conversations } from './routes/conversations.js'
import { cvs } from './routes/cvs.js'
import { templates } from './routes/templates.js'
import { files } from './routes/files.js'
import { settings } from './routes/settings.js'

const app = express()
const PORT = Number(process.env.PORT || 5000)
const origins = (process.env.ALLOWED_ORIGIN || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean)
const trustProxy = process.env.TRUST_PROXY || '0'

if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY || !process.env.MONGODB_URI || origins.length === 0 || !['0', '1'].includes(trustProxy)) {
  throw new Error('Backendin asetuksista puuttuu pakollinen Clerk-, MongoDB- tai frontend-asetus.')
}

// Clerk must run before route and request-parsing middleware.
app.use(clerkMiddleware({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY, authorizedParties: origins }))
// Only trust one explicitly configured proxy hop. Never accept arbitrary hop
// counts from configuration because that can let clients spoof their IP.
app.set('trust proxy', trustProxy === '1')
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
// Verify Clerk/Svix signatures against the untouched request bytes before the
// global JSON parser handles the application's normal API requests.
app.use('/api/webhooks/clerk', webhookLimiter, clerkWebhook)
// The application update request includes its event history; keep a firm cap
// while allowing realistic histories and CV text in the same payload.
app.use(express.json({ limit: '1mb', strict: true, type: 'application/json' }))
app.disable('x-powered-by')

app.get('/api/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1
  return res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? 'ok' : 'unavailable' })
})
// CHANGED: responses contain private user data, so never let browsers or proxies cache them.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use('/api', apiLimiter, requireUser)
app.use('/api/conversations', conversations)
app.use('/api/applications', applications)
app.use('/api/cvs', cvs)
app.use('/api/templates', templates)
app.use('/api/files', files)
app.use('/api/assistant', assistant)
app.use('/api/settings', settings)

app.use((_req, res) => res.status(404).json({ error: 'Rajapintaa ei löytynyt.' }))
app.use((error, req, res, _next) => {
  if (res.headersSent) return
  if (error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Tiedoston koko ylittää sallitun 10 Mt:n rajan.' })
  if (error?.name === 'MulterError') return res.status(400).json({ error: 'Tiedostoa ei voitu käsitellä. Tarkista tiedoston koko ja valinta.' })
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'Virheellinen JSON-pyyntö.' })
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.StrictModeError) {
    return res.status(400).json({ error: 'Tietojen tallennus epäonnistui tarkistuksessa.' })
  }
  // Keep useful operational breadcrumbs without logging request bodies, tokens,
  // CV text, or raw database errors that could contain connection details.
  console.error(JSON.stringify({ event: 'api_error', method: req.method, path: req.path, name: error?.name || 'Error' }))
  return res.status(500).json({ error: 'Palvelimella tapahtui virhe.' })
})

try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: process.env.NODE_ENV !== 'production',
  })
  // Build required unique/ownership indexes before accepting authenticated
  // traffic, including in production where automatic indexing is disabled.
  await Promise.all([User.createIndexes(), Application.createIndexes(), Cv.createIndexes(), Template.createIndexes(), Conversation.createIndexes(), ConversationMessage.createIndexes(), FileAsset.createIndexes(), ClerkDeletionJob.createIndexes()])
} catch (error) {
  console.error(JSON.stringify({ event: 'database_connect_failed', name: error?.name || 'Error' }))
  throw new Error('MongoDB-yhteyttä ei saatu avattua.')
}

const stopClerkDeletionWorker = startClerkDeletionWorker()
const server = app.listen(PORT, () => console.log(`Backend käynnissä portissa ${PORT}.`))
server.requestTimeout = 30_000
server.headersTimeout = 15_000
server.keepAliveTimeout = 5_000
server.maxRequestsPerSocket = 100
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    stopClerkDeletionWorker()
    server.close()
    await mongoose.disconnect()
    process.exit(0)
  })
}
