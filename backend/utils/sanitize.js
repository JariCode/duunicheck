import { z } from 'zod'

const text = (max) => z.string().trim().max(max)
const optionalText = (max) => z.string().trim().max(max).optional().default('')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional().default('')
const httpUrl = z.string().trim().max(2048).url().refine((value) => {
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}).or(z.literal('')).optional().default('')

export const eventSchema = z.object({
  id: z.union([z.string().max(100), z.number().finite()]).optional(),
  type: text(100),
  date,
  note: optionalText(2000),
}).strict()

export const applicationSchema = z.object({
  company: text(160).min(1),
  role: text(160).min(1),
  place: optionalText(160),
  link: httpUrl,
  cvId: optionalText(100),
  templateId: optionalText(100),
  cvFileId: z.string().regex(/^[a-f\d]{24}$/i).or(z.literal('')).optional().default(''),
  applicationFileIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10).optional().default([]),
  applicationText: optionalText(20000),
  notes: optionalText(8000),
  status: z.enum(['Kiinnostava', 'Lähetetty', 'Haastattelu sovittu', 'Hylätty']),
  respondedAt: date,
  next: optionalText(200),
  nextDate: date,
  added: date,
  events: z.array(eventSchema).max(300).optional().default([]),
}).strict()

export const cvSchema = z.object({
  name: text(120).min(1),
  fullName: text(160).min(1),
  email: z.string().trim().max(254).email().or(z.literal('')).optional().default(''),
  phone: optionalText(40),
  photo: z.string().max(700_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/).or(z.literal('')).optional().default(''),
  title: optionalText(160),
  summary: optionalText(5000),
  skills: optionalText(5000),
  experience: optionalText(12000),
  education: optionalText(8000),
  certificates: optionalText(5000),
  courses: optionalText(5000),
  languages: optionalText(3000),
  hobbies: optionalText(3000),
  linkedin: httpUrl,
  github: httpUrl,
  portfolio: httpUrl,
  website: httpUrl,
}).strict()

export const templateSchema = z.object({
  name: text(120).min(1),
  fullName: optionalText(160),
  email: z.string().trim().max(254).email().or(z.literal('')).optional().default(''),
  phone: optionalText(40),
  body: text(20000),
  linkedin: httpUrl,
  github: httpUrl,
  portfolio: httpUrl,
  website: httpUrl,
}).strict()

export const assistantSchema = z.object({
  message: text(4000).min(1),
  context: z.object({
    applicationId: z.string().regex(/^[a-f\d]{24}$/i),
    includePosting: z.boolean().default(false),
    postingText: optionalText(16000),
    includeCv: z.boolean().default(false),
    includeTemplate: z.boolean().default(false),
    includeApplication: z.boolean().default(false),
    allowSuggestions: z.literal(true),
  }).strict(),
}).strict()

export const localAnswerSchema = z.object({
  message: text(4000).min(1),
}).strict()

export function parseBody(schema, body) {
  return schema.safeParse(body)
}

export function mongoIdParam(value) {
  return /^[a-f\d]{24}$/i.test(value)
}
