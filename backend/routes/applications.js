import { Application } from '../models/Application.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { applicationSchema } from '../utils/sanitize.js'
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
})
