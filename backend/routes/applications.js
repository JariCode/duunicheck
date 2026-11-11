import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { applicationSchema, bulkDeleteSchema, parseBody } from '../utils/sanitize.js'
import { FileAsset } from '../models/FileAsset.js'
import { Cv } from '../models/Cv.js'
import { Template } from '../models/Template.js'
import { createOwnedResourceRouter } from './createOwnedResourceRouter.js'

async function deleteApplicationAndConversation({ id, userId, session }) {
  const application = await Application.findOneAndDelete({ _id: id, userId }).session(session)
  if (!application) return null
  const conversation = await Conversation.findOne({ userId, applicationId: application._id })
    .select('_id')
    .session(session)
  if (conversation) {
    await ConversationMessage.deleteMany({ userId, conversationId: conversation._id }, { session })
    await Conversation.deleteOne({ _id: conversation._id, userId }, { session })
  }
  return application
}

// Same cascade as deleteApplicationAndConversation, batched for many ids. Ids that do not belong
// to the user simply match nothing, so their existence is never revealed.
async function deleteApplicationsAndConversations({ ids, userId, session }) {
  const owned = await Application.find({ _id: { $in: ids }, userId })
    .select('_id')
    .session(session)
    .lean()
  const ownedIds = owned.map((application) => application._id)
  if (!ownedIds.length) return 0
  const conversations = await Conversation.find({ userId, applicationId: { $in: ownedIds } })
    .select('_id')
    .session(session)
    .lean()
  const conversationIds = conversations.map((conversation) => conversation._id)
  if (conversationIds.length) {
    await ConversationMessage.deleteMany({ userId, conversationId: { $in: conversationIds } }, { session })
    await Conversation.deleteMany({ _id: { $in: conversationIds }, userId }, { session })
  }
  const result = await Application.deleteMany({ _id: { $in: ownedIds }, userId }, { session })
  return result.deletedCount
}

const ownedExists = (Model, id, userId) =>
  Model.exists({ _id: id, userId })
    .then(Boolean)
    .catch(() => false)

// Older data can still point to a CV, template or file that has since been deleted. Such a
// reference is dropped silently, but only when it is already stored in this application and the
// item no longer exists for this user. New references are left as they are, so validateData still
// rejects unknown, deleted or other users' items exactly as before.
async function dropStaleReferences(data, userId, existing) {
  const next = { ...data }
  if (next.cvId && next.cvId === existing.cvId && !(await ownedExists(Cv, next.cvId, userId))) next.cvId = ''
  if (
    next.templateId &&
    next.templateId === existing.templateId &&
    !(await ownedExists(Template, next.templateId, userId))
  ) {
    next.templateId = ''
  }
  if (next.cvFileId && next.cvFileId === existing.cvFileId && !(await ownedExists(FileAsset, next.cvFileId, userId))) {
    next.cvFileId = ''
  }
  const storedFileIds = new Set(existing.applicationFileIds || [])
  const keptFileIds = []
  for (const id of next.applicationFileIds) {
    if (storedFileIds.has(id) && !(await ownedExists(FileAsset, id, userId))) continue
    keptFileIds.push(id)
  }
  next.applicationFileIds = keptFileIds
  return next
}

export const applications = createOwnedResourceRouter({
  Model: Application,
  schema: applicationSchema,
  maxItems: 500,
  deleteWithCascade: deleteApplicationAndConversation,
  normalizeData: dropStaleReferences,
  validateData: async ({ cvId, templateId, cvFileId, applicationFileIds }, userId) => {
    if (cvId) {
      const cv = await Cv.findOne({ _id: cvId, userId })
        .select('_id')
        .lean()
        .catch(() => null)
      if (!cv) return 'Valittua CV-versiota ei löydy tältä käyttäjätililtä.'
    }
    if (templateId) {
      const template = await Template.findOne({ _id: templateId, userId })
        .select('_id')
        .lean()
        .catch(() => null)
      if (!template) return 'Valittua hakemuspohjaa ei löydy tältä käyttäjätililtä.'
    }
    const ids = [...new Set([cvFileId, ...applicationFileIds].filter(Boolean))]
    if (!ids.length) return null
    const files = await FileAsset.find({ _id: { $in: ids }, userId })
      .select('_id category')
      .lean()
    if (files.length !== ids.length) return 'Yksi tai useampi liitetiedosto ei ole käytettävissä tällä käyttäjätilillä.'
    const cv = files.find((file) => String(file._id) === cvFileId)
    if (cv && cv.category !== 'cv') return 'Valittu CV-tiedosto ei ole CV-kirjastosta.'
    if (files.some((file) => applicationFileIds.includes(String(file._id)) && file.category !== 'application'))
      return 'Valittu hakemustiedosto ei ole hakemustiedostojen kirjastosta.'
    return null
  },
})

// Deletes several of the user's own applications and their conversations in one transaction.
// The generic router has no other POST route with a path segment, so /bulk-delete cannot clash with it.
applications.post('/bulk-delete', async (req, res) => {
  const result = parseBody(bulkDeleteSchema, req.body)
  if (!result.success) return res.status(400).json({ error: 'Valitse poistettavat hakemukset (1–500 kpl).' })
  let deleted = 0
  const session = await Application.db.startSession()
  try {
    await session.withTransaction(async () => {
      deleted = await deleteApplicationsAndConversations({ ids: result.data.ids, userId: req.dbUserId, session })
    })
  } catch (error) {
    console.error('Bulk application delete failed', { name: String(error?.name || 'Error').slice(0, 80) })
    return res.status(500).json({ error: 'Hakemuksia ei voitu poistaa. Yritä uudelleen.' })
  } finally {
    await session.endSession()
  }
  return res.json({ deleted })
})
