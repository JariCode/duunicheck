import mongoose from 'mongoose'

const clerkDeletionJobSchema = new mongoose.Schema(
  {
    svixId: { type: String, required: true, immutable: true, unique: true },
    clerkId: { type: String, required: true, immutable: true },
    status: { type: String, enum: ['pending', 'processing'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false },
)

clerkDeletionJobSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 })

export const ClerkDeletionJob =
  mongoose.models.ClerkDeletionJob || mongoose.model('ClerkDeletionJob', clerkDeletionJobSchema)
