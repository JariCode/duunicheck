import mongoose from 'mongoose'

const cvSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 120 },
  title: { type: String, maxlength: 160, default: '' },
  summary: { type: String, maxlength: 5000, default: '' },
  skills: { type: String, maxlength: 5000, default: '' },
  experience: { type: String, maxlength: 12000, default: '' },
  education: { type: String, maxlength: 8000, default: '' },
}, { timestamps: true, strict: 'throw', versionKey: false })
cvSchema.index({ userId: 1, updatedAt: -1 })

export const Cv = mongoose.models.Cv || mongoose.model('Cv', cvSchema)
