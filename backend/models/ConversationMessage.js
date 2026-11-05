import mongoose from 'mongoose'

const conversationMessageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true, maxlength: 12_000 },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false })
conversationMessageSchema.index({ userId: 1, conversationId: 1, createdAt: 1 })

export const ConversationMessage = mongoose.models.ConversationMessage || mongoose.model('ConversationMessage', conversationMessageSchema)
