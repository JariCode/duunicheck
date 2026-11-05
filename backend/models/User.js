import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, immutable: true, unique: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false })

export const User = mongoose.models.User || mongoose.model('User', userSchema)
