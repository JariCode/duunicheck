import { Template } from '../models/Template.js'
import { templateSchema } from '../utils/sanitize.js'
import { createOwnedResourceRouter } from './createOwnedResourceRouter.js'

export const templates = createOwnedResourceRouter({ Model: Template, schema: templateSchema, maxItems: 100 })
