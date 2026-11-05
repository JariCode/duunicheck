import mongoose from 'mongoose'

const applicationEventSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  type: { type: String, maxlength: 100 },
  date: String,
  note: { type: String, maxlength: 2000, default: '' },
}, { _id: false, strict: 'throw' })

const applicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: String, required: true, maxlength: 160 },
  role: { type: String, required: true, maxlength: 160 },
  place: { type: String, maxlength: 160, default: '' },
  link: { type: String, maxlength: 2048, default: '' },
  cvId: { type: String, maxlength: 100, default: '' },
  templateId: { type: String, maxlength: 100, default: '' },
  applicationText: { type: String, maxlength: 20000, default: '' },
  status: { type: String, required: true, enum: ['Kiinnostava', 'Lähetetty', 'Haastattelu sovittu', 'Hylätty'] },
  respondedAt: { type: String, default: '' },
  next: { type: String, maxlength: 200, default: '' },
  nextDate: { type: String, default: '' },
  added: { type: String, default: '' },
  events: { type: [applicationEventSchema], default: [] },
}, { timestamps: true, strict: 'throw', versionKey: false })
applicationSchema.index({ userId: 1, updatedAt: -1 })

export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema)
