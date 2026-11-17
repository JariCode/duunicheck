import mongoose from 'mongoose'

const conversationMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    // A suggestion has at most 12 000 output tokens (reasoning included), which in Finnish text is
    // well under 60 000 characters.
    content: { type: String, required: true, maxlength: 60_000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false },
)
conversationMessageSchema.index({ userId: 1, conversationId: 1, createdAt: 1 })

export const ConversationMessage =
  mongoose.models.ConversationMessage || mongoose.model('ConversationMessage', conversationMessageSchema)
