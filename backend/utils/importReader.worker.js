// Runs inside a worker thread with its own memory limit, so a slow or hostile file can be
// terminated without blocking the API process. Nothing read here is ever logged.
import { workerData } from 'node:worker_threads'
import { buildTable, maxTextLength } from './importTable.js'

const maxPdfPages = 30

const decodeUtf8 = (buffer) => new TextDecoder('utf-8', { fatal: true }).decode(buffer)

function decodeText(buffer, allowLegacy) {
  try {
    return decodeUtf8(buffer).replace(/^\uFEFF/, '')
  } catch {
    // Spreadsheet programs often export CSV as Windows-1252; plain text files must be UTF-8 like in the file library.
    if (!allowLegacy) throw Object.assign(new Error('encoding'), { code: 'IMPORT_ENCODING' })
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

// Cuts long text and reports how far it was read.
function limitText(text, extra = {}) {
  const clean = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (clean.length <= maxTextLength) return { kind: 'text', text: clean, truncated: null, ...extra }
  const text16k = clean.slice(0, maxTextLength)
  const tail = text16k.slice(-60).replace(/\s+/g, ' ').trim()
  return {
    kind: 'text',
    text: text16k,
    truncated: { readChars: maxTextLength, totalChars: clean.length, tail },
    ...extra,
  }
}

// --- CSV -------------------------------------------------------------------------------

function detectDelimiter(text) {
  const lines = text
    .split('\n')
    .filter((line) => line.trim())
    .slice(0, 15)
  const counts = { ';': [], ',': [], '\t': [] }
  for (const line of lines) {
    let quoted = false
    const lineCounts = { ';': 0, ',': 0, '\t': 0 }
    for (const char of line) {
      if (char === '"') quoted = !quoted
      else if (!quoted && char in lineCounts) lineCounts[char] += 1
    }
    for (const key of Object.keys(counts)) counts[key].push(lineCounts[key])
  }
  // The delimiter that appears on most lines wins; semicolon wins ties because Finnish exports use it.
  const score = (key) =>
    counts[key].filter((count) => count > 0).length * 1000 + counts[key].reduce((sum, count) => sum + count, 0)
  return [';', ',', '\t'].reduce((best, key) => (score(key) > score(best) ? key : best), ';')
}

function parseCsv(text, maxRows, maxColumns) {
  const delimiter = detectDelimiter(text)
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
      continue
    }
    if (char === '"' && field === '') quoted = true
    else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row.slice(0, maxColumns))
      row = []
      field = ''
      if (rows.length >= maxRows) break
    } else field += char
  }
  if ((field || row.length) && rows.length < maxRows) {
    row.push(field)
    rows.push(row.slice(0, maxColumns))
  }
  return rows.map((cells) => cells.map((value) => ({ text: value, formula: false })))
}

// --- Excel -----------------------------------------------------------------------------

const isoFromUtc = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

function richText(value) {
  if (typeof value === 'string') return value
  if (value && Array.isArray(value.richText)) return value.richText.map((part) => String(part?.text ?? '')).join('')
  return ''
}

// Only stored cell values are used: formulas (and their cached results), errors and
// embedded objects are skipped. Hyperlinks are passed on and checked later.
function excelCell(cell) {
  const value = cell.value
  if (value === null || value === undefined) return { text: '', formula: false }
  if (value instanceof Date)
    return Number.isFinite(value.getTime())
      ? { text: isoFromUtc(value), formula: false, date: true }
      : { text: '', formula: false }
  if (typeof value === 'number')
    return { text: Number.isFinite(value) ? String(Number(value.toPrecision(15))) : '', formula: false }
  if (typeof value === 'string') return { text: value, formula: false }
  if (typeof value === 'boolean') return { text: value ? 'Kyllä' : 'Ei', formula: false }
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) return { text: '', formula: true }
    if ('error' in value) return { text: '', formula: false }
    if ('hyperlink' in value)
      return {
        text: richText(value.text) || String(value.hyperlink || ''),
        link: typeof value.hyperlink === 'string' ? value.hyperlink : '',
        formula: false,
      }
    return { text: richText(value), formula: false }
  }
  return { text: '', formula: false }
}

async function readXlsx(buffer, maxRows, maxColumns) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer, {
    ignoreNodes: [
      'dataValidations',
      'conditionalFormatting',
      'extLst',
      'picture',
      'drawing',
      'tableParts',
      'pageSetup',
      'headerFooter',
      'printOptions',
      'rowBreaks',
      'sheetProtection',
      'autoFilter',
    ],
  })
  const sheets = []
  const skipped = []
  workbook.eachSheet((worksheet) => {
    if (sheets.length >= 10) return
    if (worksheet.state && worksheet.state !== 'visible') {
      skipped.push({ name: worksheet.name, reason: 'piilotettu välilehti' })
      return
    }
    const rows = []
    const lastRow = Math.min(worksheet.rowCount || 0, maxRows)
    const lastColumn = Math.min(worksheet.columnCount || 0, maxColumns)
    for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber)
      const cells = []
      for (let column = 1; column <= lastColumn; column += 1) cells.push(excelCell(row.getCell(column)))
      rows.push(cells)
    }
    sheets.push({ name: String(worksheet.name || 'Taulukko').slice(0, 100), rows })
  })
  return { sheets, skipped }
}

// --- Word and PDF ----------------------------------------------------------------------

async function readDocx(buffer) {
  const { default: mammoth } = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return limitText(result.value || '')
}

async function readPdf(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // isEvalSupported: false keeps pdf.js from compiling font programs with eval/Function
  // (the CVE-2024-4367 class of issues). Fonts are never installed, XFA forms and scripting
  // are not enabled, and nothing is fetched from the network.
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    useWorkerFetch: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false,
    verbosity: 0,
  })
  const document = await loadingTask.promise
  try {
    const pages = Math.min(document.numPages, maxPdfPages)
    const parts = []
    let length = 0
    let lastPage = 0
    for (let pageNumber = 1; pageNumber <= pages && length <= maxTextLength; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false })
      const text = content.items.map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ''}`).join('')
      parts.push(text)
      length += text.length + 2
      lastPage = pageNumber
      page.cleanup()
    }
    const result = limitText(parts.join('\n\n'), { totalPages: document.numPages, pagesRead: lastPage })
    if (result.truncated) result.truncated.lastPage = lastPage
    return result
  } finally {
    await loadingTask.destroy()
  }
}

async function run({ kind, buffer }) {
  const data = Buffer.from(buffer)
  if (kind === 'xlsx') {
    const workbook = await readXlsx(data, 2000, 40)
    return buildTable(workbook.sheets, workbook.skipped)
  }
  if (kind === 'csv') return buildTable([{ name: 'CSV', rows: parseCsv(decodeText(data, true), 2000, 40) }], [])
  if (kind === 'txt') return limitText(decodeText(data, false))
  if (kind === 'docx') return readDocx(data)
  if (kind === 'pdf') return readPdf(data)
  throw Object.assign(new Error('kind'), { code: 'IMPORT_KIND' })
}

// Replies go to the dedicated port from the parent, never to the shared parentPort.
const reply = (message) => {
  workerData.replyPort.postMessage(message)
  workerData.replyPort.close()
}

run(workerData).then(
  (result) => reply({ ok: true, result }),
  // Only the error's name and code leave the worker; messages can quote file content.
  (error) =>
    reply({
      ok: false,
      code: String(error?.code || '').startsWith('IMPORT_') ? error.code : 'IMPORT_READ_FAILED',
      name: String(error?.name || 'Error')
        .replace(/[^A-Za-z0-9_.-]/g, '')
        .slice(0, 80),
      errorCode: String(error?.code ?? '')
        .replace(/[^A-Za-z0-9_.-]/g, '')
        .slice(0, 80),
    }),
)
