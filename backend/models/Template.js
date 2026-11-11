import mongoose from 'mongoose'

const templateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, maxlength: 120 },
    fullName: { type: String, maxlength: 160, default: '' },
    email: { type: String, maxlength: 254, default: '' },
    phone: { type: String, maxlength: 40, default: '' },
    body: { type: String, required: true, maxlength: 20000 },
    linkedin: { type: String, maxlength: 2048, default: '' },
    github: { type: String, maxlength: 2048, default: '' },
    portfolio: { type: String, maxlength: 2048, default: '' },
    website: { type: String, maxlength: 2048, default: '' },
  },
  { timestamps: true, strict: 'throw', versionKey: false },
)
templateSchema.index({ userId: 1, updatedAt: -1 })

export const Template = mongoose.models.Template || mongoose.model('Template', templateSchema)
