import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
}, { timestamps: true, strict: 'throw', versionKey: false })
conversationSchema.index({ userId: 1, applicationId: 1 }, { unique: true })

export const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)
