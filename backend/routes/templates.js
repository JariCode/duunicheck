import { Application } from '../models/Application.js'
import { Template } from '../models/Template.js'
import { templateSchema } from '../utils/sanitize.js'
import { createOwnedResourceRouter } from './createOwnedResourceRouter.js'

// Deleting a template also clears it from the user's own applications in the same transaction.
async function deleteTemplateAndReferences({ id, userId, session }) {
  const template = await Template.findOneAndDelete({ _id: id, userId }).session(session)
  if (!template) return null
  await Application.updateMany({ userId, templateId: String(template._id) }, { $set: { templateId: '' } }, { session })
  return template
}

export const templates = createOwnedResourceRouter({
  Model: Template,
  schema: templateSchema,
  maxItems: 100,
  deleteWithCascade: deleteTemplateAndReferences,
})
