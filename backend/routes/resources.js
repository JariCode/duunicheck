import { Router } from 'express'
import { Application, Cv, Template, serialize } from '../models/UserData.js'
import { applicationSchema, cvSchema, mongoIdParam, parseBody, templateSchema } from '../utils/sanitize.js'

export const resources = Router()

function collectionRoutes(path, Model, schema) {
  resources.get(path, async (req, res) => {
    const documents = await Model.find({ ownerId: req.userId }).sort({ updatedAt: -1 }).limit(500).lean()
    res.json(documents.map((item) => ({ ...item, id: String(item._id), _id: undefined, ownerId: undefined })))
  })

  resources.post(path, async (req, res) => {
    const result = parseBody(schema, req.body)
    if (!result.success) return res.status(400).json({ error: 'Tarkista syötetyt tiedot.', details: result.error.issues.map(({ path: field }) => field.join('.')) })
    const document = await Model.create({ ...result.data, ownerId: req.userId })
    return res.status(201).json(serialize(document))
  })

  resources.put(`${path}/:id`, async (req, res) => {
    if (!mongoIdParam(req.params.id)) return res.status(400).json({ error: 'Virheellinen tunniste.' })
    const result = parseBody(schema, req.body)
    if (!result.success) return res.status(400).json({ error: 'Tarkista syötetyt tiedot.', details: result.error.issues.map(({ path: field }) => field.join('.')) })
    const document = await Model.findOneAndUpdate({ _id: req.params.id, ownerId: req.userId }, { $set: result.data }, { new: true, runValidators: true, strict: 'throw' })
    if (!document) return res.status(404).json({ error: 'Tietoa ei löytynyt.' })
    return res.json(serialize(document))
  })

  resources.delete(`${path}/:id`, async (req, res) => {
    if (!mongoIdParam(req.params.id)) return res.status(400).json({ error: 'Virheellinen tunniste.' })
    const document = await Model.findOneAndDelete({ _id: req.params.id, ownerId: req.userId })
    if (!document) return res.status(404).json({ error: 'Tietoa ei löytynyt.' })
    return res.status(204).end()
  })
}

collectionRoutes('/applications', Application, applicationSchema)
collectionRoutes('/cvs', Cv, cvSchema)
collectionRoutes('/templates', Template, templateSchema)
