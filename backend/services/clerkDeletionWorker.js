import { Application } from '../models/Application.js'
import { ClerkDeletionJob } from '../models/ClerkDeletionJob.js'
import { Conversation } from '../models/Conversation.js'
import { ConversationMessage } from '../models/ConversationMessage.js'
import { Cv } from '../models/Cv.js'
import { FileAsset } from '../models/FileAsset.js'
import { Template } from '../models/Template.js'
import { User } from '../models/User.js'

const pollIntervalMs = 5_000
const lockDurationMs = 2 * 60_000
const maxRetryDelayMs = 60 * 60_000

async function removeUserAndData(clerkId) {
  const user = await User.findOne({ clerkId }).select('_id').lean()
  if (!user) return

  const userId = user._id
  await Promise.all([
    Application.deleteMany({ userId }),
    Cv.deleteMany({ userId }),
    Template.deleteMany({ userId }),
    FileAsset.deleteMany({ userId }),
    ConversationMessage.deleteMany({ userId }),
    Conversation.deleteMany({ userId }),
  ])
  await User.deleteOne({ _id: userId })
}

async function claimJob() {
  const now = new Date()
  return ClerkDeletionJob.findOneAndUpdate(
    {
      nextAttemptAt: { $lte: now },
      $or: [{ status: 'pending' }, { status: 'processing', lockedUntil: { $lte: now } }],
    },
    {
      $set: { status: 'processing', lockedUntil: new Date(now.getTime() + lockDurationMs) },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  ).lean()
}

async function processNextJob() {
  const job = await claimJob()
  if (!job) return
  try {
    await removeUserAndData(job.clerkId)
    await ClerkDeletionJob.deleteOne({ _id: job._id })
    console.info(JSON.stringify({ event: 'clerk_user_deletion_completed' }))
  } catch (error) {
    const retryDelayMs = Math.min(30_000 * 2 ** Math.min(job.attempts - 1, 7), maxRetryDelayMs)
    await ClerkDeletionJob.updateOne(
      { _id: job._id, status: 'processing' },
      {
        $set: { status: 'pending', lockedUntil: null, nextAttemptAt: new Date(Date.now() + retryDelayMs) },
      },
    )
    console.error(JSON.stringify({ event: 'clerk_user_deletion_retry_scheduled', name: error?.name || 'Error' }))
  }
}

export function startClerkDeletionWorker() {
  let stopped = false
  let timer

  const run = async () => {
    try {
      await processNextJob()
    } catch (error) {
      console.error(JSON.stringify({ event: 'clerk_deletion_queue_error', name: error?.name || 'Error' }))
    } finally {
      if (!stopped) {
        timer = setTimeout(run, pollIntervalMs)
        timer.unref()
      }
    }
  }

  void run()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
