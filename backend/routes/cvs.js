import { Cv } from '../models/Cv.js'
import { cvSchema } from '../utils/sanitize.js'
import { createOwnedResourceRouter } from './createOwnedResourceRouter.js'

export const cvs = createOwnedResourceRouter({ Model: Cv, schema: cvSchema, maxItems: 25 })
