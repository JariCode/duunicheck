import { z } from 'zod'

const text = (max) => z.string().trim().max(max)
const optionalText = (max) => z.string().trim().max(max).optional().default('')
// The format alone lets through impossible dates such as 2026-13-45, which break the frontend.
const isCalendarDate = (value) => {
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate)
  .or(z.literal(''))
  .optional()
  .default('')
const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  })
  .or(z.literal(''))
  .optional()
  .default('')

export const applicationStatuses = ['Kiinnostava', 'Lähetetty', 'Haastattelu sovittu', 'Hyväksytty', 'Hylätty']

export const eventSchema = z
  .object({
    id: z.union([z.string().max(100), z.number().finite()]).optional(),
    type: text(100),
    date,
    note: optionalText(2000),
  })
  .strict()

export const applicationSchema = z
  .object({
    company: text(160).min(1),
    role: text(160).min(1),
    place: optionalText(160),
    link: httpUrl,
    cvId: optionalText(100),
    templateId: optionalText(100),
    cvFileId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .or(z.literal(''))
      .optional()
      .default(''),
    applicationFileIds: z
      .array(z.string().regex(/^[a-f\d]{24}$/i))
      .max(10)
      .optional()
      .default([]),
    applicationText: optionalText(20000),
    notes: optionalText(8000),
    status: z.enum(applicationStatuses),
    respondedAt: date,
    next: optionalText(200),
    nextDate: date,
    added: date,
    events: z.array(eventSchema).max(300).optional().default([]),
  })
  .strict()
  .refine((data) => !(data.cvId && data.cvFileId), {
    message: 'Valitse joko sovelluksen CV tai ladattu CV-tiedosto.',
    path: ['cvFileId'],
  })
  .refine((data) => !(data.templateId && data.applicationFileIds.length), {
    message: 'Valitse joko sovelluksen hakemuspohja tai ladattu hakukirjetiedosto.',
    path: ['applicationFileIds'],
  })

export const cvSchema = z
  .object({
    name: text(120).min(1),
    fullName: text(160).min(1),
    email: z.string().trim().max(254).email().or(z.literal('')).optional().default(''),
    phone: optionalText(40),
    photo: z
      .string()
      .max(700_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/)
      .or(z.literal(''))
      .optional()
      .default(''),
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
  })
  .strict()

export const templateSchema = z
  .object({
    name: text(120).min(1),
    fullName: optionalText(160),
    email: z.string().trim().max(254).email().or(z.literal('')).optional().default(''),
    phone: optionalText(40),
    body: text(20000),
    linkedin: httpUrl,
    github: httpUrl,
    portfolio: httpUrl,
    website: httpUrl,
  })
  .strict()

export const assistantSchema = z
  .object({
    message: text(4000).min(1),
    context: z
      .object({
        applicationId: z.string().regex(/^[a-f\d]{24}$/i),
        includePosting: z.boolean().default(false),
        postingText: optionalText(16000),
        includeCv: z.boolean().default(false),
        includeTemplate: z.boolean().default(false),
        includeApplication: z.boolean().default(false),
        includeApplicationText: z.boolean().default(false),
        allowSuggestions: z.literal(true),
      })
      .strict(),
  })
  .strict()

export const parsePostingSchema = z
  .object({
    postingText: text(16000).min(1),
    link: httpUrl,
  })
  .strict()

// Normalizes model output: invalid or missing values become empty instead of failing the request.
const clipped = (max) =>
  z
    .string()
    .catch('')
    .transform((value) => value.trim().slice(0, max))
export const postingDraftSchema = z.object({
  company: clipped(160),
  recruiter: clipped(160),
  role: clipped(160),
  place: clipped(160),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isCalendarDate)
    .catch(''),
})

// Spreadsheet columns can be mapped to these targets; interviewDate and responded are
// converted into events, next/nextDate and notes.
export const importTableFields = [
  'ignore',
  'company',
  'role',
  'place',
  'link',
  'status',
  'added',
  'respondedAt',
  'interviewDate',
  'next',
  'nextDate',
  'responded',
  'notes',
]

const importCell = z.union([
  z.string().max(1000),
  z.object({ t: z.string().max(1000), l: z.string().max(2048) }).strict(),
])
export const importTableSchema = z
  .object({
    sheets: z
      .array(
        z
          .object({
            name: z.string().max(100),
            columns: z.array(z.object({ label: z.string().max(200) }).strict()).max(40),
            rows: z
              .array(z.object({ n: z.number().int().min(1).max(1_000_000), c: z.array(importCell).max(40) }).strict())
              .max(50),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    mapping: z.record(z.string().regex(/^\d{1,2}:\d{1,2}$/), z.enum(importTableFields)),
    statusMap: z.record(z.string().max(200), z.enum([...applicationStatuses, ''])),
  })
  .strict()
  .refine((table) => table.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0) <= 50)
  .refine((table) => Object.keys(table.mapping).length <= 400 && Object.keys(table.statusMap).length <= 100)

export const importRemapSchema = z.object({ table: importTableSchema }).strict()

const objectId = z.string().regex(/^[a-f\d]{24}$/i)
export const bulkDeleteSchema = z
  .object({
    ids: z
      .array(objectId)
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length),
  })
  .strict()

export const findApplicationsSchema = z
  .object({
    message: text(2000).min(1),
  })
  .strict()

// Normalizes the search criteria returned by the model. Anything invalid is dropped instead
// of widening the search; an empty value means "no condition".
const criteriaText = z
  .string()
  .catch('')
  .transform((value) => value.trim().slice(0, 100))
const criteriaDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate)
  .catch('')
export const findCriteriaSchema = z.object({
  status: z
    .array(z.string())
    .catch([])
    .transform((values) => [...new Set(values.filter((value) => applicationStatuses.includes(value)))]),
  companyContains: criteriaText,
  roleContains: criteriaText,
  placeContains: criteriaText,
  sentFrom: criteriaDate,
  sentTo: criteriaDate,
  createdFrom: criteriaDate,
  createdTo: criteriaDate,
  hasLink: z.enum(['', 'yes', 'no']).catch(''),
})

export const localAnswerSchema = z
  .object({
    message: text(4000).min(1),
  })
  .strict()

export function parseBody(schema, body) {
  return schema.safeParse(body)
}

export function mongoIdParam(value) {
  return /^[a-f\d]{24}$/i.test(value)
}
