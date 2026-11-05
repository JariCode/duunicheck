import mongoose from 'mongoose'

const applicationEventSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  type: { type: String, maxlength: 100 },
  date: String,
  note: { type: String, maxlength: 2000, default: '' },
}, { _id: false, strict: 'throw' })

const applicationSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  company: { type: String, required: true, maxlength: 160 },
  role: { type: String, required: true, maxlength: 160 },
  place: { type: String, maxlength: 160, default: '' },
  link: { type: String, maxlength: 2048, default: '' },
  cvId: { type: String, maxlength: 100, default: '' },
  templateId: { type: String, maxlength: 100, default: '' },
  applicationText: { type: String, maxlength: 20000, default: '' },
  status: { type: String, required: true, enum: ['Kiinnostava', 'Lähetetty', 'Odottaa vastausta', 'Haastattelu', 'Tarjous', 'Hylätty'] },
  next: { type: String, maxlength: 200, default: '' },
  nextDate: { type: String, default: '' },
  added: { type: String, default: '' },
  events: { type: [applicationEventSchema], default: [] },
}, { timestamps: true, strict: 'throw', versionKey: false })

const cvSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  title: { type: String, maxlength: 160, default: '' },
  summary: { type: String, maxlength: 5000, default: '' },
  skills: { type: String, maxlength: 5000, default: '' },
  experience: { type: String, maxlength: 12000, default: '' },
  education: { type: String, maxlength: 8000, default: '' },
}, { timestamps: true, strict: 'throw', versionKey: false })

const templateSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 20000 },
}, { timestamps: true, strict: 'throw', versionKey: false })

export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema)
export const Cv = mongoose.models.Cv || mongoose.model('Cv', cvSchema)
export const Template = mongoose.models.Template || mongoose.model('Template', templateSchema)

export function serialize(document) {
  const value = document.toObject({ versionKey: false })
  return { ...value, id: String(value._id), _id: undefined, ownerId: undefined }
}
