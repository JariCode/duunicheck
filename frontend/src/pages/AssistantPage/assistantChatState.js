// Assistant chat state kept by App in memory only (never in browser storage or the database),
// so it survives switching tabs but is cleared by a page reload or signing out.

export const createAssistantChatState = (owner = '') => ({
  owner,
  context: {
    posting: false,
    cv: false,
    coverLetter: false,
    application: false,
    allowSuggestions: false,
  },
  draft: '',
  postingText: '',
  messages: [],
  sending: false,
  postingDraftMode: false,
  importMode: false,
  deleteMode: false,
  attachedFile: null,
  loadedForJobId: '',
})

export const assistantChatFields = [
  'context',
  'draft',
  'postingText',
  'messages',
  'sending',
  'postingDraftMode',
  'importMode',
  'deleteMode',
  'attachedFile',
  'loadedForJobId',
]

// Tool messages are local to this session and independent of the selected application.
export const isToolMessage = (message) => ['import-result', 'delete-search', 'posting-draft'].includes(message.role)

// Unsaved import rows, an unsaved posting draft or an unfinished delete list.
export function isPendingToolMessage(message) {
  if (message.role === 'import-result') return message.rows.some((row) => !row.saved)
  if (message.role === 'posting-draft') return !message.saved
  if (message.role === 'delete-search')
    return !message.done && !message.needsDetail && message.rows.some((row) => !row.deleted)
  return false
}

export const hasPendingChatWork = (messages) => messages.some(isPendingToolMessage)
