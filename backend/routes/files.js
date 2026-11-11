import { Router } from 'express'
import multer from 'multer'
import { Application } from '../models/Application.js'
import { FileAsset } from '../models/FileAsset.js'
import { mongoIdParam } from '../utils/sanitize.js'
import { fileUploadLimiter } from '../middleware/security.js'

const router = Router()
const maxFileSize = 10 * 1024 * 1024
// Per-user library limits.
const maxUserStorage = 50 * 1024 * 1024
const maxUserFiles = 500
const allowedTypes = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
}
// Browsers send the filename as UTF-8 without a charset parameter; multer's default latin1 garbles ä and ö.
const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: maxFileSize, files: 1, fields: 1, parts: 2 },
})

function safeFilename(value) {
  const name = String(value || 'tiedosto')
    .normalize('NFKC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .trim()
    .slice(0, 180)
  return name || 'tiedosto'
}

function validateFile(file) {
  const name = safeFilename(file.originalname)
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase()
  const mimeType = allowedTypes[extension]
  if (!mimeType) return { error: 'Sallittuja tiedostomuotoja ovat PDF, DOCX ja TXT.' }
  if (!file.buffer?.length || file.buffer.length > maxFileSize)
    return { error: 'Tiedoston koko ylittää 10 Mt:n rajan.' }

  if (extension === '.pdf' && !file.buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
    return { error: 'Tiedosto ei ole kelvollinen PDF.' }
  }
  if (extension === '.docx') {
    const header = file.buffer.subarray(0, 4).toString('hex')
    const archiveIndex = file.buffer.indexOf('[Content_Types].xml')
    const documentIndex = file.buffer.indexOf('word/document.xml')
    if (header !== '504b0304' || archiveIndex < 0 || documentIndex < 0)
      return { error: 'Tiedosto ei ole kelvollinen DOCX.' }
  }
  if (extension === '.txt') {
    if (file.buffer.includes(0)) return { error: 'Tekstitiedostossa on virheellistä sisältöä.' }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer)
    } catch {
      return { error: 'TXT-tiedoston täytyy olla UTF-8-muodossa.' }
    }
  }
  return { name, mimeType }
}

async function getUsage(userId) {
  const [usage] = await FileAsset.aggregate([
    { $match: { userId } },
    { $group: { _id: null, total: { $sum: '$size' }, count: { $sum: 1 } } },
  ])
  return { total: usage?.total || 0, count: usage?.count || 0 }
}

function serializeFile(file) {
  return {
    id: String(file._id),
    category: file.category,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    createdAt: file.createdAt,
  }
}

router.get('/', async (req, res) => {
  const files = await FileAsset.find({ userId: req.dbUserId }).select('-data').sort({ createdAt: -1 }).limit(500).lean()
  return res.json(files.map(serializeFile))
})

router.post('/', fileUploadLimiter, (req, res, next) => {
  upload.single('file')(req, res, async (error) => {
    if (error) return next(error)
    try {
      const category = req.body?.category
      if (!['cv', 'application'].includes(category))
        return res.status(400).json({ error: 'Valitse CV tai hakemus tiedoston tyypiksi.' })
      if (!req.file) return res.status(400).json({ error: 'Valitse ladattava tiedosto.' })
      const validated = validateFile(req.file)
      if (validated.error) return res.status(400).json({ error: validated.error })
      // Early rejection before storing anything.
      const before = await getUsage(req.dbUserId)
      if (before.count >= maxUserFiles)
        return res.status(413).json({ error: 'Tiedostokirjaston 500 tiedoston raja tuli vastaan.' })
      if (before.total + req.file.buffer.length > maxUserStorage) {
        return res.status(413).json({
          error: 'Tiedostokirjaston 50 Mt:n tallennustila tuli täyteen. Poista vanhoja tiedostoja ja yritä uudelleen.',
        })
      }
      const file = await FileAsset.create({
        userId: req.dbUserId,
        category,
        name: validated.name,
        mimeType: validated.mimeType,
        size: req.file.buffer.length,
        data: req.file.buffer,
      })
      // Re-check after saving: parallel uploads can all pass the early check,
      // so roll this one back if the library is now over either limit.
      const after = await getUsage(req.dbUserId)
      if (after.count > maxUserFiles || after.total > maxUserStorage) {
        await FileAsset.deleteOne({ _id: file._id, userId: req.dbUserId })
        return res.status(413).json({
          error: 'Tiedostokirjaston tallennusraja tuli vastaan. Poista vanhoja tiedostoja ja yritä uudelleen.',
        })
      }
      return res.status(201).json(serializeFile(file))
    } catch (routeError) {
      return next(routeError)
    }
  })
})

router.get('/:id/download', async (req, res) => {
  if (!mongoIdParam(req.params.id)) return res.status(400).json({ error: 'Virheellinen tiedostotunniste.' })
  // CHANGED: select size too, so Content-Length is a real value.
  const file = await FileAsset.findOne({ _id: req.params.id, userId: req.dbUserId }).select('+data name mimeType size')
  if (!file) return res.status(404).json({ error: 'Tiedostoa ei löytynyt.' })
  const asciiName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  res.set({
    'Content-Type': file.mimeType,
    'Content-Length': String(file.size),
    'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  })
  return res.send(file.data)
})

router.delete('/:id', async (req, res) => {
  if (!mongoIdParam(req.params.id)) return res.status(400).json({ error: 'Virheellinen tiedostotunniste.' })
  // The file and every reference to it in the user's own applications are removed together,
  // so no application is left pointing to a file that no longer exists.
  let file = null
  const session = await FileAsset.db.startSession()
  try {
    await session.withTransaction(async () => {
      file = await FileAsset.findOneAndDelete({ _id: req.params.id, userId: req.dbUserId }).session(session)
      if (!file) return
      const fileId = String(file._id)
      await Application.updateMany({ userId: req.dbUserId, cvFileId: fileId }, { $set: { cvFileId: '' } }, { session })
      await Application.updateMany(
        { userId: req.dbUserId, applicationFileIds: fileId },
        { $pull: { applicationFileIds: fileId } },
        { session },
      )
    })
  } finally {
    await session.endSession()
  }
  if (!file) return res.status(404).json({ error: 'Tiedostoa ei löytynyt.' })
  return res.status(204).end()
})

export const files = router
