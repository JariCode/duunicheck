import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { applicationSchema } from '../utils/sanitize.js'
import { FileAsset } from '../models/FileAsset.js'
import { createOwnedResourceRouter } from './createOwnedResourceRouter.js'

async function deleteApplicationAndConversation({ id, userId, session }) {
  const application = await Application.findOneAndDelete({ _id: id, userId }).session(session)
  if (!application) return null
  const conversation = await Conversation.findOne({ userId, applicationId: application._id }).select('_id').session(session)
  if (conversation) {
    await ConversationMessage.deleteMany({ userId, conversationId: conversation._id }, { session })
    await Conversation.deleteOne({ _id: conversation._id, userId }, { session })
  }
  return application
}

export const applications = createOwnedResourceRouter({
  Model: Application,
  schema: applicationSchema,
  deleteWithCascade: deleteApplicationAndConversation,
  validateData: async ({ cvFileId, applicationFileIds }, userId) => {
    const ids = [...new Set([cvFileId, ...applicationFileIds].filter(Boolean))]
    if (!ids.length) return null
    const files = await FileAsset.find({ _id: { $in: ids }, userId }).select('_id category').lean()
    if (files.length !== ids.length) return 'Yksi tai useampi liitetiedosto ei ole käytettävissä tällä käyttäjätilillä.'
    const cv = files.find((file) => String(file._id) === cvFileId)
    if (cv && cv.category !== 'cv') return 'Valittu CV-tiedosto ei ole CV-kirjastosta.'
    if (files.some((file) => applicationFileIds.includes(String(file._id)) && file.category !== 'application')) return 'Valittu hakemustiedosto ei ole hakemustiedostojen kirjastosta.'
    return null
  },
})
