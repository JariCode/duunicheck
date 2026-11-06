import mongoose from 'mongoose'

const cvSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 120 },
  fullName: { type: String, required: true, maxlength: 160 },
  email: { type: String, maxlength: 254, default: '' },
  phone: { type: String, maxlength: 40, default: '' },
  location: { type: String, maxlength: 120, default: '' },
  photo: { type: String, maxlength: 700_000, default: '' },
  title: { type: String, maxlength: 160, default: '' },
  summary: { type: String, maxlength: 5000, default: '' },
  skills: { type: String, maxlength: 5000, default: '' },
  experience: { type: String, maxlength: 12000, default: '' },
  education: { type: String, maxlength: 8000, default: '' },
  linkedin: { type: String, maxlength: 2048, default: '' },
  github: { type: String, maxlength: 2048, default: '' },
  portfolio: { type: String, maxlength: 2048, default: '' },
  website: { type: String, maxlength: 2048, default: '' },
}, { timestamps: true, strict: 'throw', versionKey: false })
cvSchema.index({ userId: 1, updatedAt: -1 })

export const Cv = mongoose.models.Cv || mongoose.model('Cv', cvSchema)
