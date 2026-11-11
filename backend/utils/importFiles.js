import { MessageChannel, Worker } from 'node:worker_threads'

export const maxImportFileSize = 5 * 1024 * 1024
const readTimeoutMs = 10_000
// Limits for the unpacked content of .xlsx/.docx archives (zip bomb protection).
const maxZipEntries = 2000
const maxZipTotal = 40 * 1024 * 1024
const maxZipRatio = 150

const kinds = { '.xlsx': 'xlsx', '.csv': 'csv', '.docx': 'docx', '.pdf': 'pdf', '.txt': 'txt' }
const macroOrLegacy = new Set(['.xls', '.xlsm', '.xlsb', '.xltm', '.xlam', '.docm', '.dotm', '.doc'])

export function safeImportFilename(value) {
  const name = String(value || 'tiedosto')
    .normalize('NFKC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .trim()
    .slice(0, 180)
  return name || 'tiedosto'
}

// Reads the ZIP central directory without unpacking anything. ZIP64 archives are refused.
function zipEntries(buffer) {
  let end = -1
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      end = index
      break
    }
  }
  if (end < 0) return null
  const count = buffer.readUInt16LE(end + 10)
  const size = buffer.readUInt32LE(end + 12)
  const offset = buffer.readUInt32LE(end + 16)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff || offset + size > end) return null
  const entries = []
  let position = offset
  for (let index = 0; index < count; index += 1) {
    if (position + 46 > end || buffer.readUInt32LE(position) !== 0x02014b50) return null
    const compressed = buffer.readUInt32LE(position + 20)
    const uncompressed = buffer.readUInt32LE(position + 24)
    const nameLength = buffer.readUInt16LE(position + 28)
    const extraLength = buffer.readUInt16LE(position + 30)
    const commentLength = buffer.readUInt16LE(position + 32)
    if (uncompressed === 0xffffffff || compressed === 0xffffffff) return null
    entries.push({ name: buffer.toString('utf8', position + 46, position + 46 + nameLength), compressed, uncompressed })
    position += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

// Also used for attached library files before their text is read for the AI assistant.
export function checkOfficeArchive(buffer, requiredEntry, label) {
  if (buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
    return {
      error: 'Tiedosto on salattu tai vanhassa Office-muodossa. Tallenna se ilman salasanaa .xlsx- tai .docx-muodossa.',
    }
  }
  const entries = buffer.subarray(0, 4).toString('hex') === '504b0304' ? zipEntries(buffer) : null
  if (!entries) return { error: `Tiedosto ei ole kelvollinen ${label}.` }
  const names = new Set(entries.map((entry) => entry.name))
  if (!names.has('[Content_Types].xml') || !names.has(requiredEntry))
    return { error: `Tiedosto ei ole kelvollinen ${label}.` }
  if (entries.some((entry) => /(^|\/)vbaProject\.bin$/i.test(entry.name) || /(^|\/)vbaData\.xml$/i.test(entry.name))) {
    return { error: 'Tiedostossa on makroja. Makroja sisältäviä tiedostoja ei tueta.' }
  }
  const total = entries.reduce((sum, entry) => sum + entry.uncompressed, 0)
  const suspicious = entries.some(
    (entry) => entry.uncompressed > 1024 * 1024 && entry.uncompressed / Math.max(1, entry.compressed) > maxZipRatio,
  )
  if (entries.length > maxZipEntries || total > maxZipTotal || suspicious)
    return { error: 'Tiedoston purettu sisältö on liian suuri luettavaksi.' }
  return null
}

function checkPlainText(buffer) {
  if (buffer.includes(0)) return { error: 'Tekstitiedostossa on virheellistä sisältöä.' }
  return null
}

// Checks both the extension and the content, like the file library does.
export function validateImportFile(file) {
  const name = safeImportFilename(file?.originalname)
  const dot = name.lastIndexOf('.')
  const extension = dot >= 0 ? name.slice(dot).toLowerCase() : ''
  if (macroOrLegacy.has(extension))
    return {
      error:
        'Makroja sisältäviä tai vanhoja Office-tiedostoja (esim. .xls, .xlsm) ei tueta. Tallenna tiedosto .xlsx-, .csv- tai .docx-muodossa.',
    }
  const kind = kinds[extension]
  if (!kind) return { error: 'Sallittuja tiedostomuotoja ovat Excel (.xlsx), CSV, Word (.docx), PDF ja TXT.' }
  const buffer = file.buffer
  if (!buffer?.length) return { error: 'Tiedosto on tyhjä.' }
  if (buffer.length > maxImportFileSize) return { error: 'Tiedoston koko ylittää 5 Mt:n rajan.' }

  let problem = null
  if (kind === 'pdf' && !buffer.subarray(0, 1024).toString('latin1').includes('%PDF-'))
    problem = { error: 'Tiedosto ei ole kelvollinen PDF.' }
  if (kind === 'xlsx') problem = checkOfficeArchive(buffer, 'xl/workbook.xml', 'Excel-tiedosto (.xlsx)')
  if (kind === 'docx') problem = checkOfficeArchive(buffer, 'word/document.xml', 'Word-tiedosto (.docx)')
  if (kind === 'csv' || kind === 'txt') problem = checkPlainText(buffer)
  if (kind === 'txt' && !problem) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      problem = { error: 'TXT-tiedoston täytyy olla UTF-8-muodossa.' }
    }
  }
  return problem || { name, kind }
}

const readErrors = {
  IMPORT_TIMEOUT: 'Tiedoston lukeminen kesti liian kauan. Kokeile pienempää tai yksinkertaisempaa tiedostoa.',
  IMPORT_MEMORY: 'Tiedosto on liian suuri tai monimutkainen luettavaksi. Kokeile pienempää tiedostoa.',
  IMPORT_ENCODING: 'Tiedoston merkistöä ei tunnistettu. Tallenna tiedosto UTF-8-muodossa.',
}

// Keeps only identifier-like text, so an error name or code can never carry file content into the logs.
const errorTag = (value) =>
  String(value ?? '')
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .slice(0, 80)

export class ImportReadError extends Error {
  // cause holds only the underlying error's name and code, never its message.
  constructor(code, cause = {}) {
    super(readErrors[code] || 'Tiedostoa ei voitu lukea. Tarkista, että tiedosto ei ole vioittunut.')
    this.name = 'ImportReadError'
    this.code = code || 'IMPORT_READ_FAILED'
    this.workerErrorName = errorTag(cause.name)
    this.workerErrorCode = errorTag(cause.code)
  }
}

// Parses the file in a worker thread with a memory limit and a hard time limit.
export function readImportFile(kind, buffer) {
  return new Promise((resolve, reject) => {
    const copy = new Uint8Array(buffer)
    // The reader answers on its own port. Node can post internal messages on the worker's default
    // channel (in --watch mode it reports loaded modules as 'watch:import'), so that channel is not used.
    const { port1: replies, port2: replyPort } = new MessageChannel()
    const worker = new Worker(new URL('./importReader.worker.js', import.meta.url), {
      workerData: { kind, buffer: copy, replyPort },
      transferList: [replyPort],
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 48, stackSizeMb: 4 },
      // Library warnings may quote file content, so worker output is discarded instead of logged.
      stdout: true,
      stderr: true,
    })
    worker.stdout.resume()
    worker.stderr.resume()
    let settled = false
    const finish = (callback) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      replies.close()
      void worker.terminate()
      callback()
    }
    const timer = setTimeout(() => finish(() => reject(new ImportReadError('IMPORT_TIMEOUT'))), readTimeoutMs)
    replies.once('message', (message) =>
      finish(() => {
        if (message?.ok) resolve(message.result)
        else reject(new ImportReadError(message?.code, { name: message?.name, code: message?.errorCode }))
      }),
    )
    worker.once('error', (error) =>
      finish(() =>
        reject(
          new ImportReadError(error?.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'IMPORT_MEMORY' : 'IMPORT_READ_FAILED', {
            name: error?.name,
            code: error?.code,
          }),
        ),
      ),
    )
    // The reply port can deliver its message just after the exit event, so give it a moment to arrive first.
    worker.once('exit', (exitCode) =>
      setTimeout(
        () =>
          finish(() =>
            reject(new ImportReadError('IMPORT_READ_FAILED', { name: 'WorkerExit', code: `exit_${exitCode}` })),
          ),
        100,
      ),
    )
  })
}
