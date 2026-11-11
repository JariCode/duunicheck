import { Application } from '../models/Application.js'
import { Cv } from '../models/Cv.js'
import { cvSchema } from '../utils/sanitize.js'
import { createOwnedResourceRouter } from './createOwnedResourceRouter.js'

// Deleting a CV also clears it from the user's own applications in the same transaction.
async function deleteCvAndReferences({ id, userId, session }) {
  const cv = await Cv.findOneAndDelete({ _id: id, userId }).session(session)
  if (!cv) return null
  await Application.updateMany({ userId, cvId: String(cv._id) }, { $set: { cvId: '' } }, { session })
  return cv
}

export const cvs = createOwnedResourceRouter({
  Model: Cv,
  schema: cvSchema,
  maxItems: 25,
  deleteWithCascade: deleteCvAndReferences,
})
