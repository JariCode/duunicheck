// Reads the text of files attached to an application (from the user's file library) for the AI
// assistant. Uses the same isolated reader as the file import: a worker thread with time and
// memory limits. Problems with one file become a Finnish notice instead of failing the request.
// File content is never logged.
import { FileAsset } from '../models/FileAsset.js'
import { ImportReadError, checkOfficeArchive, readImportFile } from './importFiles.js'

export const maxCharsPerDocument = 8000
export const maxAttachmentChars = 20000

const kindsByMimeType = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}

const formatCount = (value) => value.toLocaleString('fi-FI')

// Shortens a text to the per-document limit and the remaining shared budget.
export function takeFromBudget(text, budget, label, notices) {
  const limit = Math.min(maxCharsPerDocument, budget.left)
  if (limit <= 0) {
    notices.push(`${label} jätettiin pois, koska AI:lle lähetettävän tekstin enimmäismäärä täyttyi.`)
    return ''
  }
  const kept = text.slice(0, limit)
  budget.left -= kept.length
  if (kept.length < text.length) {
    notices.push(`${label} lyhennettiin: AI:lle lähetettiin ensimmäiset ${formatCount(kept.length)} merkkiä.`)
  }
  return kept
}

async function readFileText(file) {
  const kind = kindsByMimeType[file.mimeType]
  if (!kind) return { error: 'unsupported' }
  const buffer = Buffer.from(file.data)
  if (kind === 'docx' && checkOfficeArchive(buffer, 'word/document.xml', 'Word-tiedosto (.docx)')) {
    return { error: 'unreadable' }
  }
  try {
    const result = await readImportFile(kind, buffer)
    const partial = Boolean(result.truncated) || (result.totalPages && result.pagesRead < result.totalPages)
    return { text: (result.text || '').trim(), partial }
  } catch (error) {
    if (error instanceof ImportReadError) {
      console.error('Attachment text read failed', {
        code: error.code,
        workerErrorName: error.workerErrorName,
        workerErrorCode: error.workerErrorCode,
      })
    }
    return { error: 'unreadable' }
  }
}

// Returns [{ name, text }] for the user's own files in the given order, plus notices.
export async function readAttachmentTexts(fileIds, userId, budget, notices) {
  const ids = [...new Set(fileIds.filter((id) => /^[a-f\d]{24}$/i.test(id || '')))]
  if (!ids.length) return []
  const files = await FileAsset.find({ _id: { $in: ids }, userId }).select('+data name mimeType')
  const byId = new Map(files.map((file) => [String(file._id), file]))
  const parts = []
  for (const id of ids) {
    const file = byId.get(id)
    if (!file) {
      notices.push('Yhtä liitettyä tiedostoa ei enää löytynyt, joten se jätettiin pois.')
      continue
    }
    const label = `Tiedoston ${file.name} teksti`
    if (budget.left <= 0) {
      notices.push(`${label} jätettiin pois, koska AI:lle lähetettävän tekstin enimmäismäärä täyttyi.`)
      continue
    }
    const read = await readFileText(file)
    if (read.error) {
      notices.push(`Tiedoston ${file.name} tekstiä ei voitu lukea, joten se jätettiin pois.`)
      continue
    }
    if (!read.text) {
      notices.push(
        `Tiedostosta ${file.name} ei löytynyt luettavaa tekstiä (esimerkiksi skannattu PDF), joten se jätettiin pois.`,
      )
      continue
    }
    if (read.partial) notices.push(`${label} oli pitkä, joten siitä luettiin vain alkuosa.`)
    const text = takeFromBudget(read.text, budget, label, notices)
    if (text) parts.push({ name: file.name, text })
  }
  return parts
}
