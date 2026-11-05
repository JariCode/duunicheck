import mongoose from 'mongoose'

const templateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 20000 },
}, { timestamps: true, strict: 'throw', versionKey: false })
templateSchema.index({ userId: 1, updatedAt: -1 })

export const Template = mongoose.models.Template || mongoose.model('Template', templateSchema)
