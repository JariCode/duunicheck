import { Router } from 'express'
import { serialize } from '../models/serialize.js'
import { mongoIdParam, parseBody } from '../utils/sanitize.js'

export function createOwnedResourceRouter({ Model, schema, deleteWithCascade, validateData, maxItems }) {
  const router = Router()

  router.get('/', async (req, res) => {
    const documents = await Model.find({ userId: req.dbUserId }).sort({ updatedAt: -1 }).limit(500).lean()
    res.json(documents.map((item) => {
      const { _id, userId, ...data } = item
      return { ...data, id: String(_id) }
    }))
  })

  router.post('/', async (req, res) => {
    const result = parseBody(schema, req.body)
    if (!result.success) return res.status(400).json({
      error: 'Hakemuksen tietoja ei voitu tallentaa. Tarkista merkityt kentät.',
      details: result.error.issues.flatMap((issue) => issue.code === 'unrecognized_keys' ? issue.keys.map((field) => ({ field, message: 'Tuntematon kenttä.' })) : [{ field: issue.path.join('.'), message: issue.message, code: issue.code }]),
    })
    if (validateData) {
      const validationError = await validateData(result.data, req.dbUserId)
      if (validationError) return res.status(400).json({ error: validationError })
    }
    if (maxItems && await Model.countDocuments({ userId: req.dbUserId }) >= maxItems) {
      return res.status(413).json({ error: 'Enimmäismäärä on täynnä. Poista vanhoja ja yritä uudelleen.' })
    }
    const document = await Model.create({ ...result.data, userId: req.dbUserId })
    return res.status(201).json(serialize(document))
  })

  router.put('/:id', async (req, res) => {
    if (!mongoIdParam(req.params.id)) return res.status(400).json({ error: 'Virheellinen tunniste.' })
    const result = parseBody(schema, req.body)
    if (!result.success) return res.status(400).json({
      error: 'Tietoja ei voitu tallentaa. Tarkista merkityt kentät.',
      details: result.error.issues.flatMap((issue) => issue.code === 'unrecognized_keys' ? issue.keys.map((field) => ({ field, message: 'Tuntematon kenttä.' })) : [{ field: issue.path.join('.'), message: issue.message, code: issue.code }]),
    })
    if (validateData) {
      const validationError = await validateData(result.data, req.dbUserId)
      if (validationError) return res.status(400).json({ error: validationError })
    }
    const document = await Model.findOneAndUpdate({ _id: req.params.id, userId: req.dbUserId }, { $set: result.data }, { returnDocument: 'after', runValidators: true, strict: 'throw' })
    if (!document) return res.status(404).json({ error: 'Tietoa ei löytynyt.' })
    return res.json(serialize(document))
  })

  router.delete('/:id', async (req, res) => {
    if (!mongoIdParam(req.params.id)) return res.status(400).json({ error: 'Virheellinen tunniste.' })
    let document
    if (deleteWithCascade) {
      const session = await Model.db.startSession()
      try {
        await session.withTransaction(async () => {
          document = await deleteWithCascade({ id: req.params.id, userId: req.dbUserId, session })
        })
      } finally {
        await session.endSession()
      }
    } else {
      document = await Model.findOneAndDelete({ _id: req.params.id, userId: req.dbUserId })
    }
    if (!document) return res.status(404).json({ error: 'Tietoa ei löytynyt.' })
    return res.status(204).end()
  })

  return router
}
