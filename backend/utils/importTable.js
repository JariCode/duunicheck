// Finds the header row and data rows of spreadsheet-like input. Pure functions without
// dependencies, so they run inside the reader worker.

export const maxTextLength = 16000
export const maxImportRows = 50
const maxCellLength = 1000
const maxTableChars = 300_000
const headerScanRows = 20

const headerWords =
  /(yritys|yhtiö|työnantaja|organisaatio|company|employer|tehtävä|nimike|rooli|title|role|position|paikka|sijainti|kaupunki|location|city|linkki|url|link|ilmoitus|tila|status|vaihe|lähetetty|haettu|päivä|pvm|date|vastaus|vastattu|haastattelu|interview|muistiinpano|lisätieto|huomio|notes|kommentti|seuraava|next)/i
const summaryRow = /^(yhteensä|yht\.?|summa|total|totals|keskiarvo|average)(\s|:|$)/i
const isNumeric = (text) => /^[-+]?\d+(?:[.,]\d+)?$/.test(text)

const columnLetter = (index) => {
  let value = index + 1
  let letters = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    value = Math.floor((value - 1) / 26)
  }
  return letters
}

const cleanText = (value) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxCellLength)
const hasValue = (cell) => Boolean(cell.text || cell.link)

/**
 * @param {{ name: string, rows: { text: string, link?: string, formula: boolean, date?: boolean }[][] }[]} rawSheets
 * @param {{ name: string, reason: string }[]} skipped
 */
export function buildTable(rawSheets, skipped) {
  const sheets = []
  let totalRows = 0
  let includedRows = 0
  let usedChars = 0
  let truncatedByChars = false

  for (const rawSheet of rawSheets) {
    const rows = rawSheet.rows.map((cells) =>
      cells.map((cell) => ({ ...cell, text: cleanText(cell.text), link: cleanText(cell.link).slice(0, 2048) })),
    )
    const formulaCount = rows.reduce((sum, cells) => sum + cells.filter((cell) => cell.formula).length, 0)

    // The header is the early row with the most text labels; known column words weigh more.
    let headerIndex = -1
    let bestScore = 0
    for (let index = 0; index < Math.min(headerScanRows, rows.length); index += 1) {
      const labels = rows[index].filter((cell) => cell.text && !cell.date && !isNumeric(cell.text))
      if (labels.length < 2) continue
      const score = labels.length + labels.filter((cell) => headerWords.test(cell.text)).length * 2
      if (score > bestScore) {
        bestScore = score
        headerIndex = index
      }
    }
    const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows
    const valueCount = dataRows.reduce(
      (sum, cells) => sum + cells.filter((cell) => !cell.formula && hasValue(cell)).length,
      0,
    )
    if (formulaCount > 0 && formulaCount >= valueCount) {
      skipped.push({ name: rawSheet.name, reason: 'vain kaavoja' })
      continue
    }
    if (headerIndex < 0) {
      skipped.push({ name: rawSheet.name, reason: 'otsikkoriviä ei löytynyt' })
      continue
    }

    const header = rows[headerIndex]
    const width = Math.max(header.length, ...dataRows.map((cells) => cells.length))
    const columnIndexes = []
    for (let column = 0; column < width; column += 1) {
      if (header[column]?.text || dataRows.some((cells) => cells[column] && hasValue(cells[column])))
        columnIndexes.push(column)
    }

    const keptRows = []
    for (let index = 0; index < dataRows.length; index += 1) {
      const cells = dataRows[index]
      const filled = cells.filter(hasValue)
      if (!filled.length) continue
      // Running numbers and totals rows carry no application data.
      if (filled.every((cell) => !cell.link && (isNumeric(cell.text) || cell.date))) continue
      if (summaryRow.test(filled[0].text)) continue
      totalRows += 1
      if (includedRows >= maxImportRows) continue
      const row = columnIndexes.map((column) => {
        const cell = cells[column]
        if (!cell || !hasValue(cell)) return ''
        return cell.link ? { t: cell.text, l: cell.link } : cell.text
      })
      const size = row.reduce(
        (sum, cell) => sum + (typeof cell === 'string' ? cell.length : cell.t.length + cell.l.length),
        0,
      )
      if (usedChars + size > maxTableChars) {
        truncatedByChars = true
        continue
      }
      usedChars += size
      includedRows += 1
      keptRows.push({ n: headerIndex + index + 2, c: row })
    }
    if (!keptRows.length && !totalRows) {
      skipped.push({ name: rawSheet.name, reason: 'ei hakemusrivejä' })
      continue
    }
    sheets.push({
      name: cleanText(rawSheet.name).slice(0, 100) || 'Taulukko',
      columns: columnIndexes.map((column) => ({
        label: (header[column]?.text || `Sarake ${columnLetter(column)}`).slice(0, 200),
      })),
      rows: keptRows,
    })
  }

  return {
    kind: 'table',
    sheets: sheets.filter((sheet) => sheet.rows.length),
    skipped,
    totalRows,
    includedRows,
    truncatedByChars,
  }
}
