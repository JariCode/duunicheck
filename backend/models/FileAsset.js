import mongoose from 'mongoose'

const fileAssetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    category: { type: String, required: true, enum: ['cv', 'application'] },
    name: { type: String, required: true, maxlength: 180 },
    mimeType: {
      type: String,
      required: true,
      enum: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
    },
    size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false },
)
fileAssetSchema.index({ userId: 1, category: 1, createdAt: -1 })

export const FileAsset = mongoose.models.FileAsset || mongoose.model('FileAsset', fileAssetSchema)
