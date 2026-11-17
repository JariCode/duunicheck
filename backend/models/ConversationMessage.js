import mongoose from 'mongoose'

const conversationMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    // A suggestion has at most 12 000 output tokens (reasoning included), which in Finnish text is
    // well under 60 000 characters.
    content: { type: String, required: true, maxlength: 60_000 },
    // 'ai': an AI suggestion request and reply (/assistant/suggest). 'local': a question about the
    // application and the answer DuuniCheck built from its data (/conversations/:id/answer). Only
    // 'ai' messages are sent to OpenAI as history; messages saved before this field have none.
    source: { type: String, enum: ['ai', 'local'] },
    // A cover letter on its own, when an AI reply contains one; the user can save it as a new template.
    letter: { type: String, maxlength: 20_000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false },
)
conversationMessageSchema.index({ userId: 1, conversationId: 1, createdAt: 1 })

export const ConversationMessage =
  mongoose.models.ConversationMessage || mongoose.model('ConversationMessage', conversationMessageSchema)
