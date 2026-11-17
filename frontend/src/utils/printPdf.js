// Builds the print documents (CV, hakemus, kirje, muistiinpanot) as an A4 PDF on the device.
// Used where window.print() does not work (the iOS home screen app). The layout reproduces the
// @media print rules of PrintSheet.css (sizes in pt, spacing in mm, colours and borders), and the
// content logic follows PrintSheet.jsx. Nothing is sent anywhere: the DM Sans fonts are bundled from
// an npm package and pdfmake is not allowed to fetch any URL.
import pdfMakeModule from 'pdfmake/build/pdfmake'
// The same DM Sans as the app's own woff2 files (identical metrics), as TTF because pdfmake cannot
// subset woff2 fonts. SIL Open Font License.
import dmSans400 from '@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf?inline'
import dmSans700 from '@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf?inline'
import dmSans800 from '@expo-google-fonts/dm-sans/800ExtraBold/DMSans_800ExtraBold.ttf?inline'
import { safeHttpUrl } from '../utils'

const pdfMake = pdfMakeModule.createPdf ? pdfMakeModule : pdfMakeModule.default
// The only resources are the bundled fonts and the CV photo data URL, so every URL fetch is refused.
pdfMake.setUrlAccessPolicy(() => false)
const base64 = (dataUrl) => dataUrl.replace(/^data:[^,]*,/, '')
pdfMake.addVirtualFileSystem({
  'DMSans-400.ttf': base64(dmSans400),
  'DMSans-700.ttf': base64(dmSans700),
  'DMSans-800.ttf': base64(dmSans800),
})
pdfMake.fonts = {
  // font-weight 400 and 700 (bold).
  DMSans: {
    normal: 'DMSans-400.ttf',
    bold: 'DMSans-700.ttf',
    italics: 'DMSans-400.ttf',
    bolditalics: 'DMSans-700.ttf',
  },
  // font-weight 800.
  DMSansExtraBold: {
    normal: 'DMSans-800.ttf',
    bold: 'DMSans-800.ttf',
    italics: 'DMSans-800.ttf',
    bolditalics: 'DMSans-800.ttf',
  },
}

const mm = (value) => (value * 72) / 25.4
const px = (value) => value * 0.75
const PAGE_WIDTH = 595.28
// DM Sans: ascender 992 + descender 310 units per 1000, no line gap.
const ASCENT = 0.992
const DESCENT = 0.31
const FONT_LINE_HEIGHT = ASCENT + DESCENT

// Chrome rounds the font's ascent and descent to whole CSS pixels (0.75pt) when it places the
// baseline inside a line; the PDF does the same so that text sits where it does in the print.
const snapPx = (pt) => Math.round(pt / 0.75) * 0.75

// Chrome also rounds a border of 1px or more down to whole pixels (1mm prints as 3px = 2.25pt).
const borderWidth = (pt) => (pt >= 0.75 ? Math.floor(pt / 0.75 + 1e-6) * 0.75 : pt)

// One CSS text block. CSS line-height is relative to the font size, pdfmake's lineHeight to the
// font's own line height. CSS puts half of the extra leading above the text and half below it,
// pdfmake puts all of it below, so the text is moved down to the CSS baseline; the height of the
// block stays the same.
function text(content, { size, lineHeight, color, weight = 400, letterSpacing, margin = [0, 0, 0, 0], ...rest }) {
  const lineBox = size * lineHeight
  const ascent = snapPx(size * ASCENT)
  const baselineShift = (lineBox - ascent - snapPx(size * DESCENT)) / 2 + ascent - size * ASCENT
  return {
    text: content,
    fontSize: size,
    lineHeight: lineBox / (size * FONT_LINE_HEIGHT),
    color,
    ...(weight === 800 ? { font: 'DMSansExtraBold' } : { bold: weight >= 700 }),
    ...(letterSpacing ? { characterSpacing: letterSpacing } : {}),
    margin: [margin[0], margin[1] + baselineShift, margin[2], margin[3] - baselineShift],
    ...rest,
  }
}

// Width of a single line of text, measured by the browser with the app's own DM Sans.
function textWidth(content, size, weight = 400) {
  const context = textWidth.context || (textWidth.context = window.document.createElement('canvas').getContext('2d'))
  context.font = `${weight} ${size}pt "DM Sans", Arial, sans-serif`
  return context.measureText(content).width * 0.75
}

const noLines = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
}

// A block with optional borders, padding and background, like a CSS box. Table lines are drawn
// between the padding boxes, so a border adds to the box size as in CSS.
function box(content, { padding = [0, 0, 0, 0], border = {}, fill, margin = [0, 0, 0, 0], ...rest }) {
  const [top, right, bottom, left] = padding
  const side = (name) => {
    const [width, color] = border[name] || [0, null]
    return [borderWidth(width), color]
  }
  return {
    table: { widths: ['*'], body: [[content]] },
    layout: {
      hLineWidth: (index) => side(index === 0 ? 'top' : 'bottom')[0],
      vLineWidth: (index) => side(index === 0 ? 'left' : 'right')[0],
      hLineColor: (index) => side(index === 0 ? 'top' : 'bottom')[1],
      vLineColor: (index) => side(index === 0 ? 'left' : 'right')[1],
      fillColor: () => fill || null,
      paddingLeft: () => left,
      paddingRight: () => right,
      paddingTop: () => top,
      paddingBottom: () => bottom,
    },
    margin,
    ...rest,
  }
}

/* --------------------------- Pyöristetyt laatikot --------------------------- */

// border-radius 2mm: the CV columns. pdfmake's table fills are square, so a rounded box lays out its
// content between two zero-size markers (measuredBlock). The first rendering measures where the
// markers are (see createPrintPdf), and the second paints the background (and any borders)
// underneath as rounded shapes (roundedBackground).
const BOX_RADIUS = mm(2)
const ROUNDED_ID = 'rounded-'
// Points per quarter circle; at 2mm the segments are far below the printer's resolution.
const ARC_STEPS = 16

// pdfmake only reports the position of a node that draws something, so the marker is an empty rect.
const marker = (id) => ({ id, canvas: [{ type: 'rect', x: 0, y: 0, w: 0, h: 0, color: '#ffffff' }] })

// A block whose top and bottom are measured: `${id}` marks the top, `${id}-body` is the content
// (its first page, in case the content moved on to the next page) and `${id}-end` the bottom.
function measuredBlock(id, content, { margin = [0, 0, 0, 0], ...rest } = {}) {
  return { stack: [marker(id), { ...content, id: `${id}-body` }, marker(`${id}-end`)], margin, ...rest }
}

// Outline of a rectangle with elliptical corners [rx, ry] (top-left, top-right, bottom-right,
// bottom-left), clockwise on the page.
function roundedOutline(x, y, w, h, corners) {
  const centres = [
    [x, y, 1, 1, Math.PI],
    [x + w, y, -1, 1, Math.PI * 1.5],
    [x + w, y + h, -1, -1, 0],
    [x, y + h, 1, -1, Math.PI * 0.5],
  ]
  const points = []
  centres.forEach(([cx, cy, sx, sy, start], index) => {
    const [rx, ry] = corners[index]
    if (rx <= 0 || ry <= 0) {
      points.push({ x: cx, y: cy })
      return
    }
    for (let step = 0; step <= ARC_STEPS; step += 1) {
      const angle = start + (step / ARC_STEPS) * (Math.PI / 2)
      points.push({ x: cx + sx * rx + rx * Math.cos(angle), y: cy + sy * ry + ry * Math.sin(angle) })
    }
  })
  return points
}

// The part of a convex polygon inside another convex polygon (Sutherland–Hodgman).
function clipPolygon(points, clip) {
  const area = clip.reduce((sum, p, i) => sum + (p.x * clip[(i + 1) % clip.length].y - clip[(i + 1) % clip.length].x * p.y), 0)
  const side = (a, b, p) => Math.sign(area) * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) >= 0
  let result = points
  clip.forEach((a, i) => {
    const b = clip[(i + 1) % clip.length]
    const input = result
    result = []
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length]
      const pIn = side(a, b, p)
      const qIn = side(a, b, q)
      if (pIn) result.push(p)
      if (pIn !== qIn) {
        const d1 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
        const d2 = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)
        const t = d1 / (d1 - d2)
        result.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) })
      }
    })
  })
  return result
}

const shape = (points, color) => ({ type: 'polyline', closePath: true, points, color })

// One page's part of a rounded box, from `top` to `bottom`. Like Chrome's sliced boxes, an edge
// where the box continues on another page has no rounding and no border.
function roundedPiece({ x, width, fill, border }, top, bottom, { roundTop, roundBottom }) {
  const r = (round) => (round ? [BOX_RADIUS, BOX_RADIUS] : [0, 0])
  const outer = roundedOutline(x, top, width, bottom - top, [r(roundTop), r(roundTop), r(roundBottom), r(roundBottom)])
  const [bt, topColor] = roundTop ? border.top : [0, null]
  const [bb, bottomColor] = roundBottom ? border.bottom : [0, null]
  const [bl, leftColor] = border.left
  const [br, rightColor] = border.right
  if (!bt && !bb && !bl && !br) return [shape(outer, fill)]
  // The background fills the padding box, whose corners have the radius minus the border widths.
  // The thin border colour fills the rest of the box; the thick left border is the part left of the
  // lines that join the outer and inner corners, where Chrome divides the border colours.
  const inner = (round, rx, ry) => (round ? [Math.max(0, BOX_RADIUS - rx), Math.max(0, BOX_RADIUS - ry)] : [0, 0])
  const padding = roundedOutline(x + bl, top + bt, width - bl - br, bottom - top - bt - bb, [
    inner(roundTop, bl, bt),
    inner(roundTop, br, bt),
    inner(roundBottom, br, bb),
    inner(roundBottom, bl, bb),
  ])
  const thin = topColor || rightColor || bottomColor
  const vectors = [shape(outer, thin || leftColor)]
  if (bl && leftColor !== thin) {
    const left = [
      { x, y: top },
      { x: x + bl, y: top + bt },
      { x: x + bl, y: bottom - bb },
      { x, y: bottom },
    ]
    vectors.push(shape(clipPolygon(outer, left), leftColor))
  }
  vectors.push(shape(padding, fill))
  return vectors
}

// The page background with every rounded box measured by the first rendering. A box that continues
// on the next page is painted down to the bottom edge of the paper, as Chrome does.
function roundedBackground(rounded, spans) {
  const placed = rounded
    .map((item) => {
      const start = spans[item.id]
      const body = spans[`${item.id}-body`]
      const end = spans[`${item.id}-end`]
      if (!start || !end) return null
      // The marker stayed at the bottom of a page when the content moved on to the next one.
      const first = body && body.page > start.page ? { page: body.page, top: NO_PAGE_MARGIN_Y } : start
      return { item, first, end }
    })
    .filter(Boolean)
  if (!placed.length) return undefined
  return (page) => {
    const canvas = placed.flatMap(({ item, first, end }) => {
      if (page < first.page || page > end.page) return []
      const top = page === first.page ? first.top : 0
      const bottom = page === end.page ? end.top : A4_HEIGHT
      return roundedPiece(item, top, bottom, { roundTop: page === first.page, roundBottom: page === end.page })
    })
    return canvas.length ? { canvas } : null
  }
}

const displayUrl = (url) => url.replace(/^https?:\/\//, '')

// profileLinks and replaceLetterFields are the same as in PrintSheet.jsx. They are copied here
// because a .jsx file that exports anything besides components breaks React Fast Refresh (lint rule
// react-refresh/only-export-components). Keep the two copies in sync.
function profileLinks(person) {
  return [
    ['LinkedIn', person.linkedin],
    ['GitHub', person.github],
    ['Portfolio', person.portfolio],
    ['Verkkosivu', person.website],
  ]
    .map(([label, value]) => [label, safeHttpUrl(value)])
    .filter(([, url]) => url)
}

function replaceLetterFields(text, { job, cv }) {
  const values = {
    yritys: job?.company || '',
    company: job?.company || '',
    tehtävä: job?.role || '',
    role: job?.role || '',
    nimi: cv?.fullName || '',
    name: cv?.fullName || '',
    sijainti: job?.place || '',
    place: job?.place || '',
  }
  return text.replace(
    /\{\{\s*(yritys|company|tehtävä|role|nimi|name|sijainti|place)\s*\}\}/gi,
    (_, key) => values[key.toLowerCase()] || '',
  )
}

/* ---------------------------------- CV ---------------------------------- */

// @page { margin: 0 }: the document's top padding is only on the first page, and a page that
// continues the document starts at the top edge of the paper, as in Chrome's print.
const NO_PAGE_MARGIN_Y = 0
const A4_HEIGHT = 841.89
const NO_BORDER = { top: [0, null], right: [0, null], bottom: [0, null], left: [0, null] }

// Every size and gap of the CV, the same values as the .print-cv rules of PrintSheet.css (keep the two
// in sync). Font sizes in pt, lengths in mm. Font sizes, line heights, paddings and the photo are
// fixed; the values under `gaps` are multiplied by the gap scale, like calc(... * var(--cv-gap)).
const CV_STYLE = {
  // .print-document.print-cv: 8.5pt / 1.35, padding 10mm 12mm.
  pageX: 12,
  pageY: 10,
  // .cv-print-hero: padding-bottom 5mm, gap 8mm; name 20pt / 1.05; title 10.5pt / 1.3, margin-top
  // 1.2mm; contact line 8.5pt / 1.35, margin-top 2mm; photo 27 x 34 mm.
  heroBottom: 5,
  heroGap: 8,
  name: { size: 20, lineHeight: 1.05 },
  title: { size: 10.5, lineHeight: 1.3, top: 1.2 },
  contact: { size: 8.5, lineHeight: 1.35, top: 2 },
  photo: { width: 27, height: 34 },
  // .print-section h2: 9.5pt / 1.15, padding-bottom 0.8mm.
  heading: { size: 9.5, lineHeight: 1.15, paddingBottom: 0.8 },
  // p and li: 8.5pt / 1.35.
  text: { size: 8.5, lineHeight: 1.35 },
  // .cv-experience-list h3: 9pt / 1.25, margin-bottom 0.6mm.
  job: { size: 9, lineHeight: 1.25, bottom: 0.6 },
  // .print-links: 8pt / 1.3, gap 1.6mm between links, 0.3mm between label and address.
  link: { size: 8, lineHeight: 1.3, gap: 1.6, inner: 0.3 },
  // .cv-print-columns: 55mm sidebar, column-gap 7mm, padding 4mm; lists: padding-left 3.5mm,
  // li padding-left 0.3mm, sidebar rows 0.7mm apart, main column lists in two columns 6mm apart.
  sidebar: 55,
  columnGap: 7,
  columnPadding: 4,
  listIndent: 3.5,
  itemIndent: 0.3,
  sidebarRowGap: 0.7,
  listColumnGap: 6,
  gaps: {
    // Under the header (.cv-print-hero margin-bottom) and under the Profiili section.
    afterHero: 4,
    afterProfile: 4,
    // Between sections: sidebar 3.5mm; main column 4mm (also after the last one).
    sidebarSection: 3.5,
    mainSection: 4,
    // Between a section heading and its content (h2 margin-bottom).
    heading: 1.6,
    // Between jobs (.cv-experience-list gap) and between the rows of the two-column lists.
    job: 2.4,
    listRow: 0.5,
  },
}
// The gap scale runs from 0.6 to 1.8 in steps of 0.1; 1 is the default.
const GAP_STEPS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8]
// A CV that fits on one page keeps this much free space at the bottom of the page.
const FIT_MARGIN = mm(3)

const CV_PAGE_X = mm(CV_STYLE.pageX)
const CV_PAGE_Y = mm(CV_STYLE.pageY)
// List items are not paragraphs, so they keep the document colour #252331.
const CV_ITEM = { ...CV_STYLE.text, color: '#252331' }
// .print-cv .print-section p: #393642.
const CV_TEXT = { ...CV_STYLE.text, color: '#393642' }
const CV_SIDEBAR = mm(CV_STYLE.sidebar)
const CV_COLUMN_GAP = mm(CV_STYLE.columnGap)
const CV_COLUMN_PADDING = mm(CV_STYLE.columnPadding)
// Width of the main column's content box.
const CV_MAIN_CONTENT = PAGE_WIDTH - 2 * CV_PAGE_X - CV_SIDEBAR - CV_COLUMN_GAP - 2 * CV_COLUMN_PADDING
const CV_COLUMNS_ID = `${ROUNDED_ID}columns`

// The gaps of CV_STYLE in pt for one gap scale.
function cvGaps(scale) {
  return Object.fromEntries(Object.entries(CV_STYLE.gaps).map(([name, value]) => [name, mm(value * scale)]))
}

// .print-cv .print-section h2: border-bottom 0.8pt #9273b2.
function cvSectionHeading(title, gaps) {
  return box(text(title, { ...CV_STYLE.heading, weight: 700, color: '#493267' }), {
    padding: [0, 0, mm(CV_STYLE.heading.paddingBottom), 0],
    border: { bottom: [0.8, '#9273b2'] },
    margin: [0, 0, 0, gaps.heading],
  })
}

function bulletItems(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*[•*-]\s*/, '').trim())
    .filter(Boolean)
}

// A list with the list and item indents of CV_STYLE. The marker is Chrome's outside disc: diameter
// 0.3125em, about 1.44em before the text, centred on the first line. `gap` is the space between items.
function cvList(items, { indent = mm(CV_STYLE.listIndent + CV_STYLE.itemIndent), gap = 0 } = {}) {
  const lineBox = CV_ITEM.size * CV_ITEM.lineHeight
  const radius = (CV_ITEM.size * 0.3125) / 2
  return {
    stack: items.map((item, index) => ({
      columns: [
        {
          width: indent,
          canvas: [
            {
              type: 'ellipse',
              x: indent - CV_ITEM.size * 1.4375 + radius,
              y: lineBox / 2 + CV_ITEM.size * 0.07,
              r1: radius,
              r2: radius,
              color: '#7550a8',
            },
          ],
        },
        text(item, { ...CV_ITEM, width: '*' }),
      ],
      columnGap: 0,
      margin: [0, 0, 0, index < items.length - 1 ? gap : 0],
    })),
  }
}

// Number of lines a list item takes in the given width, wrapped at spaces like the browser does.
function lineCount(content, width) {
  let lines = 1
  let line = ''
  for (const word of content.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (line && textWidth(candidate, CV_ITEM.size) > width) {
      lines += 1
      line = word
    } else line = candidate
  }
  return lines
}

// CSS column-fill: balance makes the columns as even as possible, and an item is never split
// (break-inside: avoid): the first column takes items up to the lowest height that leaves the rest
// no taller. Each item counts its wrapped lines plus the row gap under it.
function balancedSplit(items, width, rowGap) {
  const heights = items.map((item) => lineCount(item, width) * CV_ITEM.size * CV_ITEM.lineHeight + rowGap)
  const total = heights.reduce((sum, height) => sum + height, 0)
  let best = { split: Math.ceil(items.length / 2), height: Infinity }
  let first = 0
  heights.forEach((height, index) => {
    first += height
    const tallest = Math.max(first, total - first)
    if (tallest <= best.height + 0.01) best = { split: index + 1, height: tallest }
  })
  return best.split
}

// In the main column the list is split into two CSS columns filled top to bottom. The list's padding
// is only on the left of the first column, so the second column's markers sit in the gap: each half
// is the column plus the list indent, and the gap between them is the column gap minus that indent.
function cvBulletSection(title, value, gaps, { twoColumns = false } = {}) {
  const items = bulletItems(value)
  if (!items.length) return null
  let list
  if (twoColumns) {
    // The text width in one CSS column: (content - list indent - column gap) / 2 - item indent.
    const width = (CV_MAIN_CONTENT - mm(CV_STYLE.listIndent + CV_STYLE.listColumnGap)) / 2 - mm(CV_STYLE.itemIndent)
    const half = balancedSplit(items, width, gaps.listRow)
    list = {
      columns: [cvList(items.slice(0, half), { gap: gaps.listRow }), cvList(items.slice(half), { gap: gaps.listRow })],
      columnGap: mm(CV_STYLE.listColumnGap - CV_STYLE.listIndent),
    }
  } else list = cvList(items, { gap: mm(CV_STYLE.sidebarRowGap) })
  return { stack: [cvSectionHeading(title, gaps), list], unbreakable: true }
}

function cvExperience(value, gaps) {
  const entries = String(value || '')
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (!entries.length) return null
  const articles = entries.map((entry, index) => {
    const [heading, ...details] = entry
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    return {
      stack: [
        text(heading, { ...CV_STYLE.job, weight: 700, color: '#30233e', margin: [0, 0, 0, mm(CV_STYLE.job.bottom)] }),
        details.length > 0 && text(details.join('\n'), CV_TEXT),
      ].filter(Boolean),
      unbreakable: true,
      margin: [0, 0, 0, index < entries.length - 1 ? gaps.job : 0],
    }
  })
  // The heading stays on the same page as the first entry.
  return {
    stack: [{ stack: [cvSectionHeading('Työkokemus', gaps), articles[0]], unbreakable: true }, ...articles.slice(1)],
  }
}

// Sections stacked with the given bottom margin. In the sidebar the last one has none
// (:last-child); in the main column `.print-cv .cv-print-main .print-section` comes later in
// PrintSheet.css with the same specificity, so the last section keeps its margin.
function sectionStack(sections, gap, { lastMargin = 0 } = {}) {
  const present = sections.filter(Boolean)
  present.forEach((section, index) => {
    section.margin = [0, 0, 0, index < present.length - 1 ? gap : lastMargin]
  })
  return { stack: present }
}

function cvContent(cv, photo, scale = 1) {
  const links = profileLinks(cv)
  const rounded = []
  const gaps = cvGaps(scale)
  const photoWidth = mm(CV_STYLE.photo.width)

  // .cv-print-hero: grid (1fr auto), centred, border-bottom 1mm. Name and title, then email and
  // phone on one line separated by a middle dot.
  const contactLine = [
    cv.email && { text: cv.email, link: `mailto:${cv.email}`, color: '#302440' },
    cv.email && cv.phone && { text: ' · ', color: '#9273b2' },
    cv.phone && { text: cv.phone, link: `tel:${cv.phone.replace(/[^+\d]/g, '')}`, color: '#302440' },
  ].filter(Boolean)
  const heroText = {
    stack: [
      text(cv.fullName || '', { ...CV_STYLE.name, weight: 700, color: '#242037', letterSpacing: px(-0.8) }),
      cv.title &&
        text(cv.title, { ...CV_STYLE.title, weight: 700, color: '#67468f', margin: [0, mm(CV_STYLE.title.top), 0, 0] }),
      contactLine.length > 0 &&
        text(contactLine, { ...CV_STYLE.contact, color: '#484451', margin: [0, mm(CV_STYLE.contact.top), 0, 0] }),
    ].filter(Boolean),
    verticalAlignment: 'middle',
  }
  const heroCells = [heroText]
  if (photo) {
    // object-fit: cover and the 1.5mm border-radius are already in the image (pdfPhoto).
    heroCells.push({ image: photo, width: photoWidth, height: mm(CV_STYLE.photo.height), verticalAlignment: 'middle' })
  }
  // The band reaches the page edges, so it cancels the page margins. The bottom border is one
  // rectangle, because per-cell table lines leave a visible seam where the cells meet.
  const hero = {
    stack: [
      {
        table: { widths: photo ? ['*', photoWidth] : ['*'], body: [heroCells] },
        layout: {
          ...noLines,
          fillColor: () => '#f2eff8',
          paddingLeft: (index) => (index === 0 ? CV_PAGE_X : mm(CV_STYLE.heroGap)),
          paddingRight: (index, node) => (index === node.table.widths.length - 1 ? CV_PAGE_X : 0),
          paddingTop: () => CV_PAGE_Y,
          paddingBottom: () => mm(CV_STYLE.heroBottom),
        },
      },
      { canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_WIDTH, h: borderWidth(mm(1)), color: '#7954aa' }] },
    ],
    margin: [-CV_PAGE_X, 0, -CV_PAGE_X, gaps.afterHero],
    unbreakable: true,
  }

  // .cv-print-profile: the summary as a full-width section under the header.
  const profile = cv.summary && {
    stack: [cvSectionHeading('Profiili', gaps), text(cv.summary, CV_TEXT)],
    margin: [0, 0, 0, gaps.afterProfile],
    unbreakable: true,
  }

  const { link } = CV_STYLE
  const linkList = {
    stack: links.map(([label, url], index) => ({
      stack: [
        text(label, { size: link.size, lineHeight: link.lineHeight, weight: 700, color: '#393340' }),
        text(displayUrl(url), {
          size: link.size,
          lineHeight: link.lineHeight,
          color: '#4f3b70',
          link: url,
          margin: [0, mm(link.inner), 0, 0],
        }),
      ],
      margin: [0, 0, 0, index < links.length - 1 ? mm(link.gap) : 0],
    })),
  }

  const sidebar = sectionStack(
    [
      cvBulletSection('IT-taidot', cv.skills, gaps),
      cvBulletSection('Kielitaito', cv.languages, gaps),
      links.length > 0 && { stack: [cvSectionHeading('Linkit', gaps), linkList], unbreakable: true },
    ],
    gaps.sidebarSection,
  )
  const main = sectionStack(
    [
      cvExperience(cv.experience, gaps),
      cvBulletSection('Koulutus', cv.education, gaps, { twoColumns: true }),
      cvBulletSection('Sertifikaatit', cv.certificates, gaps, { twoColumns: true }),
      cvBulletSection('Kurssit', cv.courses, gaps, { twoColumns: true }),
      cv.hobbies && {
        stack: [cvSectionHeading('Harrastukset', gaps), text(cv.hobbies, CV_TEXT)],
        unbreakable: true,
      },
    ],
    gaps.mainSection,
    { lastMargin: gaps.mainSection },
  )

  // .cv-print-columns: sidebar (#f6f4f9) and main column (#fbf9fd), both with padding and
  // border-radius 2mm. Both columns are as tall as the taller one. The top and bottom padding are
  // margins of the content, so a page that continues the columns starts at the top edge without
  // padding, like Chrome's sliced boxes. The backgrounds are painted by roundedBackground, also down
  // to the bottom edge of a page where the columns continue.
  sidebar.margin = [0, CV_COLUMN_PADDING, 0, CV_COLUMN_PADDING]
  main.margin = [0, CV_COLUMN_PADDING, 0, CV_COLUMN_PADDING]
  const mainX = CV_PAGE_X + CV_SIDEBAR + CV_COLUMN_GAP
  rounded.push(
    { id: CV_COLUMNS_ID, x: CV_PAGE_X, width: CV_SIDEBAR, fill: '#f6f4f9', border: NO_BORDER },
    { id: CV_COLUMNS_ID, x: mainX, width: PAGE_WIDTH - CV_PAGE_X - mainX, fill: '#fbf9fd', border: NO_BORDER },
  )
  const columns = measuredBlock(CV_COLUMNS_ID, {
    table: {
      widths: [CV_SIDEBAR - 2 * CV_COLUMN_PADDING, CV_COLUMN_GAP, '*'],
      body: [[sidebar, { text: '' }, main]],
    },
    layout: {
      ...noLines,
      paddingLeft: (column) => (column === 1 ? 0 : CV_COLUMN_PADDING),
      paddingRight: (column) => (column === 1 ? 0 : CV_COLUMN_PADDING),
    },
  })

  return {
    pageMargins: [CV_PAGE_X, NO_PAGE_MARGIN_Y, CV_PAGE_X, NO_PAGE_MARGIN_Y],
    content: [hero, profile, columns].filter(Boolean),
    rounded,
  }
}

// Chrome's text can be up to about 0.7% wider than pdfmake's, so a line near the edge may wrap one
// word earlier in Chrome. The measuring layout adds this much spacing per character, so the CV is
// measured slightly wider and taller than either print; the chosen scale then fits both.
const MEASURE_CHARACTER_SPACING = 0.03

// Where the CV ends with the given gap scale: lays it out with pdfmake and reads the position of the
// marker at the bottom of the columns ({ page, top } in pt).
async function cvEnd(cv, photo, scale) {
  let end = null
  const definition = {
    pageSize: 'A4',
    ...cvContent(cv, photo, scale),
    defaultStyle: { font: 'DMSans', fontSize: 10, color: '#252331', characterSpacing: MEASURE_CHARACTER_SPACING },
  }
  delete definition.rounded
  definition.pageBreakBefore = (node) => {
    if (node.id === `${CV_COLUMNS_ID}-end`) end = { page: node.startPosition.pageNumber, top: node.startPosition.top }
    return false
  }
  await pdfMake.createPdf(definition).getBlob()
  return end
}

// The gap scale of a CV, the same for the PDF and for Chrome's print (App.jsx sets it as --cv-gap
// before window.print()): the largest step with which the CV ends at least 3mm above the bottom of
// the first page. A CV that does not fit on one page even with the smallest gaps gets 1 and
// continues on the next page.
export async function cvGapScale(cv = {}) {
  await window.document.fonts?.load(`400 ${CV_ITEM.size}pt "DM Sans"`)
  const photo = await pdfPhoto(cv.photo)
  const fits = async (scale) => {
    const end = await cvEnd(cv, photo, scale)
    return Boolean(end) && end.page === 1 && end.top <= A4_HEIGHT - FIT_MARGIN
  }
  if (!(await fits(GAP_STEPS[0]))) return 1
  // The CV only gets taller as the gaps grow, so the largest fitting step is found by bisection.
  let low = 0
  let high = GAP_STEPS.length - 1
  if (await fits(GAP_STEPS[high])) return GAP_STEPS[high]
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (await fits(GAP_STEPS[middle])) low = middle
    else high = middle
  }
  return GAP_STEPS[low]
}

/* ------------------------------ Hakemus ------------------------------ */

// .print-document: padding 17mm 18mm; 10pt / 1.55.
const LETTER_PAGE_X = mm(18)
const LETTER_PAGE_Y = mm(17)

function letterParagraphs(letterBody) {
  return letterBody
    ? letterBody
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const lines = part.split(/\r?\n/)
          const heading = lines[0].match(/^#\s+(.+)$/)?.[1] || ''
          if (heading) lines.shift()
          return { heading, text: lines.join('\n').trim() }
        })
    : []
}

// .letter-label: 7pt/800, uppercase, letter-spacing 1px, margin-bottom 1.5mm.
const letterLabel = (label, extra = {}) =>
  text(label.toUpperCase(), {
    size: 7,
    lineHeight: 1.55,
    weight: 800,
    color: '#7550a8',
    letterSpacing: px(1),
    margin: [0, 0, 0, mm(1.5)],
    ...extra,
  })

// .letter-links li: flex-wrap with gap 1.5mm. The link goes on the label's line when it fits,
// otherwise onto its own line.
function letterLinkItem(label, url, width) {
  const size = 7.5
  const shown = displayUrl(url)
  const sameLine = textWidth(label, size, 700) + mm(1.5) + textWidth(shown, size) <= width
  const labelText = text(label, { size, lineHeight: 1.55, weight: 700, color: '#4a4650' })
  const linkText = text(shown, { size, lineHeight: 1.55, color: '#4f3b70', link: url })
  if (sameLine) {
    return { columns: [{ ...labelText, width: 'auto' }, { ...linkText, width: '*' }], columnGap: mm(1.5) }
  }
  // The flex gap also separates the wrapped lines.
  return { stack: [labelText, { stack: [linkText], margin: [0, mm(1.5), 0, 0] }] }
}

function applicationContent(document) {
  const { job = {}, cv = {}, body = '' } = document
  const contact = [cv.email, cv.phone].filter(Boolean)
  const links = profileLinks(cv)
  const letterBody = replaceLetterFields(body, { job, cv }).trim()
  const date = new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const hasGreeting = /^(hei|hyvä|arvoisa)\b/im.test(letterBody)
  const hasClosing = /(ystävällisin terveisin|ystävällisin|terveisin|parhain terveisin)/i.test(letterBody)
  const paragraphs = letterParagraphs(letterBody)
  const contentWidth = PAGE_WIDTH - 2 * LETTER_PAGE_X

  // .letter-titlebar: full width, padding 5mm 18mm, #30263b, 15pt/800, letter-spacing 2px,
  // margin-bottom 6mm.
  const titlebar = {
    table: {
      widths: ['*'],
      body: [
        [
          text('HAKUKIRJE', {
            size: 15,
            lineHeight: 1.55,
            weight: 800,
            color: '#ffffff',
            letterSpacing: px(2),
            alignment: 'center',
            // CSS also counts the spacing after the last letter when centring.
            margin: [0, 0, px(2), 0],
          }),
        ],
      ],
    },
    layout: {
      ...noLines,
      fillColor: () => '#30263b',
      paddingLeft: () => LETTER_PAGE_X,
      paddingRight: () => LETTER_PAGE_X,
      paddingTop: () => mm(5),
      paddingBottom: () => mm(5),
    },
    margin: [-LETTER_PAGE_X, 0, -LETTER_PAGE_X, mm(6)],
  }

  // .letter-sender: name 23pt/700 and title 10pt/700 on the left, contact lines and the date under
  // them 8.5pt on the right (gap 1.5mm), centred vertically; padding-bottom 5mm, border-bottom 1px
  // #ded9e7. There is no recipient box: the company is named in the letter and the role in its heading.
  const sender = box(
    {
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              stack: [
                text(cv.fullName || '', { size: 23, lineHeight: 1.08, weight: 700, color: '#242037', letterSpacing: px(-0.8) }),
                cv.title && text(cv.title, { size: 10, lineHeight: 1.55, weight: 700, color: '#67468f', margin: [0, mm(1), 0, 0] }),
              ].filter(Boolean),
              verticalAlignment: 'middle',
            },
            {
              stack: [...contact, date].map((item, index) =>
                text(item, {
                  size: 8.5,
                  lineHeight: 1.55,
                  color: '#4c4854',
                  alignment: 'right',
                  margin: [0, index > 0 ? mm(1.5) : 0, 0, 0],
                }),
              ),
              verticalAlignment: 'middle',
            },
          ],
        ],
      },
      layout: { ...noLines, paddingLeft: (index) => (index === 1 ? mm(10) : 0) },
    },
    { padding: [0, 0, mm(5), 0], border: { bottom: [px(1), '#ded9e7'] } },
  )

  // .letter-content h2: 17pt/700, line-height 1.2, padding-bottom 2mm, border-bottom 1pt #cfc2dd,
  // margin-bottom 5mm.
  const role =
    job.role && [
      letterLabel('Haettava tehtävä'),
      box(text(job.role, { size: 17, lineHeight: 1.2, weight: 700, color: '#30233e' }), {
        padding: [0, 0, mm(2), 0],
        border: { bottom: [1, '#cfc2dd'] },
        margin: [0, 0, 0, mm(5)],
      }),
    ]

  // .letter-body: 10pt / 1.65, #302d37. Paragraphs have margin-bottom 4mm; a # heading starts a
  // section with border-left 1mm #d6c9e4, padding 0 0 3mm 4mm and margin-bottom 5mm.
  const bodyText = { size: 10, lineHeight: 1.65, color: '#302d37' }
  const bodyBlocks = [
    !hasGreeting && text('Hei,', { ...bodyText, margin: [0, 0, 0, mm(4)] }),
    ...paragraphs.map(({ heading, text: paragraph }) =>
      heading
        ? box(
            {
              stack: [
                text(heading, { size: 10, lineHeight: 1.2, weight: 700, color: '#50376b', margin: [0, 0, 0, mm(1.5)] }),
                paragraph && text(paragraph, bodyText),
              ].filter(Boolean),
            },
            {
              padding: [0, 0, mm(3), mm(4)],
              border: { left: [mm(1), '#d6c9e4'] },
              margin: [0, 0, 0, mm(5)],
              unbreakable: true,
            },
          )
        : text(paragraph, { ...bodyText, margin: [0, 0, 0, mm(4)] }),
    ),
    // .letter-signoff: padding-top 4mm, border-top 1px #e2d9ec. Its margin-top is overridden by
    // `.print-application .letter-body > p`, so only the previous paragraph's 4mm separates it.
    !hasClosing &&
      box(text(`Ystävällisin terveisin,\n${cv.fullName || ''}`, bodyText), {
        padding: [mm(4), 0, 0, 0],
        border: { top: [px(1), '#e2d9ec'] },
        margin: [0, 0, 0, mm(4)],
      }),
  ].filter(Boolean)

  // .letter-links: margin-top 7mm (it collapses with the last paragraph's margin), padding-top 3mm,
  // border-top 1px #d8cfdf; heading 9pt/700, margin-bottom 2mm; two columns, gap 1.5mm 7mm.
  let linksFooter = null
  if (links.length) {
    // The 7mm replaces the last block's own bottom margin (5mm after a # section, otherwise 4mm).
    const lastBlock = bodyBlocks.at(-1)
    const lastIsSection = hasClosing && Boolean(paragraphs.at(-1)?.heading)
    if (lastBlock) lastBlock.margin[3] -= lastIsSection ? mm(5) : mm(4)
    const columnWidth = (contentWidth - mm(7)) / 2
    const items = links.map(([label, url]) => letterLinkItem(label, url, columnWidth))
    const rows = []
    for (let index = 0; index < items.length; index += 2) rows.push([items[index], items[index + 1] || { text: '' }])
    linksFooter = box(
      {
        stack: [
          text('Linkit', { size: 9, lineHeight: 1.55, weight: 700, color: '#493267', margin: [0, 0, 0, mm(2)] }),
          {
            table: { widths: ['*', '*'], body: rows },
            layout: {
              ...noLines,
              paddingLeft: (index) => (index === 1 ? mm(7) : 0),
              paddingBottom: (row, node) => (row < node.table.body.length - 1 ? mm(1.5) : 0),
            },
          },
        ],
      },
      {
        padding: [mm(3), 0, 0, 0],
        border: { top: [px(1), '#d8cfdf'] },
        margin: [0, mm(7), 0, 0],
        unbreakable: true,
      },
    )
  }

  return {
    pageMargins: [LETTER_PAGE_X, NO_PAGE_MARGIN_Y, LETTER_PAGE_X, NO_PAGE_MARGIN_Y],
    content: [
      titlebar,
      sender,
      // .print-application .letter-content: margin-top 6mm under the header line.
      { stack: [...(role || []), { stack: bodyBlocks }], margin: [0, mm(6), 0, 0] },
      linksFooter,
    ].filter(Boolean),
  }
}

/* --------------------------- Hakemuksen yhteenveto --------------------------- */

// "Tulosta yhteenveto / PDF": the application summary built by utils/applicationSummary.js. Sizes and
// colours are those of the .print-applicationSummary rules in PrintSheet.css.
const SUMMARY_HEADING_ID = 'summary-heading-'
// .summary-section h2: 11pt / 1.2, padding-bottom 1.5mm, border-bottom 1.4pt. createPrintPdf moves a
// heading to the next page when nothing of its section follows it on the page (break-after: avoid).
const SUMMARY_HEADING_HEIGHT = 11 * 1.2 + mm(1.5) + borderWidth(1.4)
const SUMMARY_CELL = { size: 9.5, lineHeight: 1.45, color: '#302d37' }

function summaryHeading(title, index) {
  return box(text(title, { size: 11, lineHeight: 1.2, weight: 700, color: '#493267' }), {
    padding: [0, 0, mm(1.5), 0],
    border: { bottom: [1.4, '#7550a8'] },
    margin: [0, 0, 0, mm(2.5)],
    id: `${SUMMARY_HEADING_ID}${index}`,
  })
}

// .summary-table: table-layout fixed, cells 9.5pt / 1.45 with padding 1.6mm 3mm 1.6mm 0 (the last
// column without right padding) and border-bottom 1px #ece7f2; a row never breaks across pages.
// `columns` are the CSS column widths in mm (null = the rest); pdfmake widths exclude the padding.
function summaryTable(columns, rows, header = null) {
  const last = columns.length - 1
  const body = header
    ? [
        header.map((label) =>
          text(label.toUpperCase(), { size: 7.5, lineHeight: 1.45, weight: 800, color: '#7550a8', letterSpacing: px(1) }),
        ),
        ...rows,
      ]
    : rows
  return {
    table: {
      widths: columns.map((width, index) => (width === null ? '*' : mm(width) - (index === last ? 0 : mm(3)))),
      body,
      dontBreakRows: true,
      ...(header ? { headerRows: 1, keepWithHeaderRows: 1 } : {}),
    },
    layout: {
      hLineWidth: (index) => (index === 0 ? 0 : borderWidth(px(1))),
      // .summary-events thead th: border-bottom-color #cfc2dd.
      hLineColor: (index) => (header && index === 1 ? '#cfc2dd' : '#ece7f2'),
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: (index) => (index === last ? 0 : mm(3)),
      paddingTop: (row) => (header && row === 0 ? 0 : mm(1.6)),
      paddingBottom: (row) => (header && row === 0 ? mm(1.2) : mm(1.6)),
    },
  }
}

function applicationSummaryContent(document) {
  const { title = '', subtitle = '', printed = '', facts = [], attachments = [], events = [], notes = '', applicationText = '' } = document
  // The same title bar as the cover letter, with "HAKEMUS".
  const titlebar = {
    table: {
      widths: ['*'],
      body: [
        [
          text('HAKEMUS', {
            size: 15,
            lineHeight: 1.55,
            weight: 800,
            color: '#ffffff',
            letterSpacing: px(2),
            alignment: 'center',
            // CSS also counts the spacing after the last letter when centring.
            margin: [0, 0, px(2), 0],
          }),
        ],
      ],
    },
    layout: {
      ...noLines,
      fillColor: () => '#30263b',
      paddingLeft: () => LETTER_PAGE_X,
      paddingRight: () => LETTER_PAGE_X,
      paddingTop: () => mm(5),
      paddingBottom: () => mm(5),
    },
    margin: [-LETTER_PAGE_X, 0, -LETTER_PAGE_X, mm(6)],
  }
  // .summary-header: the role 23pt and company · place 11pt/700 on the left, "Tulostettu …" 8.5pt on
  // the right, both at the bottom; padding-bottom 5mm, border-bottom 1px #ded9e7, margin-bottom 6mm.
  const header = box(
    {
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              stack: [
                text(title, { size: 23, lineHeight: 1.08, weight: 700, color: '#242037', letterSpacing: px(-0.8) }),
                subtitle && text(subtitle, { size: 11, lineHeight: 1.55, weight: 700, color: '#67468f', margin: [0, mm(1), 0, 0] }),
              ].filter(Boolean),
              verticalAlignment: 'bottom',
            },
            { ...text(printed, { size: 8.5, lineHeight: 1.55, color: '#686372' }), verticalAlignment: 'bottom' },
          ],
        ],
      },
      layout: { ...noLines, paddingLeft: (index) => (index === 1 ? mm(10) : 0) },
    },
    { padding: [0, 0, mm(5), 0], border: { bottom: [px(1), '#ded9e7'] }, margin: [0, 0, 0, mm(6)] },
  )

  const label = (value, color = '#67468f') => text(value, { ...SUMMARY_CELL, weight: 700, color })
  const sections = []
  const section = (heading, content) =>
    sections.push({ stack: [summaryHeading(heading, sections.length), content], margin: [0, 0, 0, mm(7)] })
  if (facts.length)
    section(
      'Perustiedot',
      summaryTable(
        [45, null],
        facts.map(({ label: name, value, href }) => [
          label(name),
          href
            ? text(value.replace(/^https?:\/\//, ''), { ...SUMMARY_CELL, color: '#4f3b70', link: href })
            : text(value, SUMMARY_CELL),
        ]),
      ),
    )
  if (attachments.length)
    section(
      'Liitteet',
      summaryTable(
        [45, null],
        attachments.map((item) =>
          item.missing
            ? [label('Poistettu', '#8a8394'), text(item.missing, { ...SUMMARY_CELL, color: '#8a8394' })]
            : [label(item.label), text(item.value, SUMMARY_CELL)],
        ),
      ),
    )
  if (events.length)
    section(
      'Tapahtumahistoria',
      summaryTable(
        [28, 50, null],
        events.map((event) => [text(event.date, SUMMARY_CELL), text(event.type, SUMMARY_CELL), text(event.note, SUMMARY_CELL)]),
        ['Päivä', 'Tapahtuma', 'Lisätieto'],
      ),
    )
  // .summary-notes p: 10pt / 1.55 #393642, line breaks kept. Without text()'s baseline shift: pdfmake
  // would need that extra space at the bottom of the page too, and break long notes one line
  // earlier than Chrome (the text is drawn about 0.3mm higher instead).
  const notesText = (value) => ({
    ...text(value, { size: 10, lineHeight: 1.55, color: '#393642', preserveLeadingSpaces: true }),
    margin: [0, 0, 0, 0],
  })
  if (notes) section('Muistiinpanot', notesText(notes))
  // An old application text too long for the notes: the same style as the notes.
  if (applicationText) section('Vanha hakemusteksti', notesText(applicationText))

  return {
    // .print-document: padding 17mm 18mm; the first page starts with the title bar at the top edge.
    pageMargins: [LETTER_PAGE_X, NO_PAGE_MARGIN_Y, LETTER_PAGE_X, NO_PAGE_MARGIN_Y],
    content: [titlebar, header, ...sections],
  }
}

/* --------------------------- Kirje, muistiinpanot --------------------------- */

function letterContent(document) {
  return {
    pageMargins: [LETTER_PAGE_X, NO_PAGE_MARGIN_Y, LETTER_PAGE_X, NO_PAGE_MARGIN_Y],
    // .letter-body: 10.5pt / 1.8, max-width 165mm.
    content: [
      text(String(document.body || ''), {
        size: 10.5,
        lineHeight: 1.8,
        color: '#302d37',
        margin: [0, LETTER_PAGE_Y, PAGE_WIDTH - 2 * LETTER_PAGE_X - mm(165), 0],
      }),
    ],
  }
}

function notesContent(document) {
  const blocks = document.blocks || []
  return {
    pageMargins: [LETTER_PAGE_X, NO_PAGE_MARGIN_Y, LETTER_PAGE_X, NO_PAGE_MARGIN_Y],
    content: [
      // .print-notes h1: 28pt/700, line-height 1.08, letter-spacing -0.8px, margin-bottom 8mm.
      text(document.title || '', {
        size: 28,
        lineHeight: 1.08,
        weight: 700,
        color: '#242037',
        letterSpacing: px(-0.8),
        margin: [0, LETTER_PAGE_Y, 0, mm(8)],
      }),
      // .print-section (margin-bottom 7mm): h2 11pt/700, line-height 1.2, padding-bottom 1.5mm,
      // border-bottom 1.4pt #7550a8, margin-bottom 2.5mm; p 10pt / 1.55 #393642.
      ...blocks.map((block, index) => ({
        stack: [
          box(text(String(block.title || ''), { size: 11, lineHeight: 1.2, weight: 700, color: '#493267' }), {
            padding: [0, 0, mm(1.5), 0],
            border: { bottom: [1.4, '#7550a8'] },
            margin: [0, 0, 0, mm(2.5)],
          }),
          text(String(block.body || ''), { size: 10, lineHeight: 1.55, color: '#393642' }),
        ],
        unbreakable: true,
        margin: [0, 0, 0, index < blocks.length - 1 ? mm(7) : 0],
      })),
    ],
  }
}

/* -------------------------------- Kuvat -------------------------------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Kuvaa ei voitu lukea.'))
    image.src = src
  })
}

// .print-cv .cv-print-photo: 27 x 34 mm, object-fit: cover, border-radius 1.5mm.
const PHOTO_WIDTH_MM = 27
const PHOTO_HEIGHT_MM = 34
const PHOTO_RADIUS_MM = 1.5
// The photo is drawn at 600 dpi, so the rounded corners are as smooth in print as Chrome's clipping.
const PHOTO_WIDTH_PX = Math.round((PHOTO_WIDTH_MM / 25.4) * 600)

// The CV photo as pdfmake gets it: cropped like object-fit: cover (centred), with transparent rounded
// corners, as PNG. Any image type the browser reads (JPEG, PNG, WebP) works, because it is drawn on a
// canvas. Both renderings of a CV (see createPrintPdf) use the same photo, so the last one is kept.
async function pdfPhoto(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null
  if (pdfPhoto.cache?.source === dataUrl) return pdfPhoto.cache.png
  const image = await loadImage(dataUrl)
  const aspect = PHOTO_WIDTH_MM / PHOTO_HEIGHT_MM
  const cropWidth = Math.min(image.naturalWidth, image.naturalHeight * aspect)
  const cropHeight = cropWidth / aspect
  const canvas = window.document.createElement('canvas')
  canvas.width = PHOTO_WIDTH_PX
  canvas.height = Math.round((PHOTO_WIDTH_PX * PHOTO_HEIGHT_MM) / PHOTO_WIDTH_MM)
  const context = canvas.getContext('2d')
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    (image.naturalWidth - cropWidth) / 2,
    (image.naturalHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  // Everything outside the rounded rectangle becomes transparent.
  const r = (PHOTO_RADIUS_MM / PHOTO_WIDTH_MM) * canvas.width
  const { width: w, height: h } = canvas
  context.globalCompositeOperation = 'destination-in'
  context.beginPath()
  context.moveTo(r, 0)
  context.arcTo(w, 0, w, h, r)
  context.arcTo(w, h, 0, h, r)
  context.arcTo(0, h, 0, 0, r)
  context.arcTo(0, 0, w, 0, r)
  context.closePath()
  context.fill()
  const png = canvas.toDataURL('image/png')
  canvas.width = 0
  canvas.height = 0
  pdfPhoto.cache = { source: dataUrl, png }
  return png
}

/* ---------------------------- Tiedosto ja otsikko ---------------------------- */

// Characters that are not allowed or are awkward in file names become word breaks.
function safeFileName(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%{}^~[\]`'$&@+=,;!]/g, ' ')
    // eslint-disable-next-line no-control-regex -- control characters are not allowed in file names
    .replace(/[\u0000-\u001f\u007f·•–—]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80)
    .replace(/[._]+$/g, '')
}

export function pdfFileName(document) {
  const kind = document?.kind || 'notes'
  const named = (prefix, value) => {
    const name = safeFileName(value)
    return `${name ? `${prefix}_${name}` : prefix}.pdf`
  }
  if (kind === 'cv') return named('CV', document.cv?.fullName || document.title)
  if (kind === 'application') return named('Hakemus', document.job?.company || document.cv?.fullName)
  if (kind === 'letter') return named('Kirje', document.title)
  if (kind === 'applicationSummary')
    return named('Hakemus', [document.job?.company, document.job?.role].filter(Boolean).join(' '))
  return named('Muistiinpanot', String(document?.title || '').replace(/^Muistiinpanot\s*·?\s*/, ''))
}

export function pdfTitle(document) {
  const kind = document?.kind || 'notes'
  if (kind === 'cv') return document.cv?.fullName ? `CV – ${document.cv.fullName}` : 'CV'
  if (kind === 'application') return document.job?.company ? `Hakemus – ${document.job.company}` : 'Hakemus'
  if (kind === 'applicationSummary') return document.job?.company ? `Hakemus – ${document.job.company}` : 'Hakemus'
  return document?.title || 'DuuniCheck'
}

// spans: where the markers of the rounded boxes were in a previous rendering ({ [id]: { page, top } }).
// Without them the rounded boxes are laid out but not painted. gapScale: the CV's gap scale (cvGapScale).
export async function buildPdfDefinition(document, spans = null, gapScale = 1) {
  const kind = document?.kind || 'notes'
  let definition
  if (kind === 'cv') {
    const cv = document.cv || {}
    // The two-column lists are balanced with widths measured in the app's DM Sans.
    await window.document.fonts?.load(`400 ${CV_ITEM.size}pt "DM Sans"`)
    definition = cvContent(cv, await pdfPhoto(cv.photo), gapScale)
  } else if (kind === 'application') {
    // Link widths are measured with the app's DM Sans, so the weights must be loaded first.
    await Promise.all(['400 10pt "DM Sans"', '700 10pt "DM Sans"'].map((font) => window.document.fonts?.load(font)))
    definition = applicationContent(document)
  } else if (kind === 'applicationSummary') {
    // Long words in the cells are wrapped with the app's DM Sans, so the weights must be loaded first.
    await Promise.all(['400 10pt "DM Sans"', '700 10pt "DM Sans"'].map((font) => window.document.fonts?.load(font)))
    definition = applicationSummaryContent(document)
  } else if (kind === 'letter') definition = letterContent(document)
  else definition = notesContent(document)
  const { rounded = [], ...layout } = definition
  return {
    pageSize: 'A4',
    language: 'fi-FI',
    info: { title: pdfTitle(document), creator: 'DuuniCheck' },
    ...layout,
    background: spans ? roundedBackground(rounded, spans) : undefined,
    // .print-document: color #252331.
    defaultStyle: { font: 'DMSans', fontSize: 10, color: '#252331' },
  }
}

// Returns the finished PDF as a File for navigator.share().
export async function createPrintPdf(document) {
  const spans = {}
  const gapScale = document?.kind === 'cv' ? await cvGapScale(document.cv || {}) : 1
  const render = async (measured) => {
    const definition = await buildPdfDefinition(document, measured, gapScale)
    // Called after layout for every node; records where the markers of the rounded boxes ended up.
    // The only break it adds: an application summary section heading that would end a page with
    // nothing of its section under it moves to the next page (break-after: avoid in PrintSheet.css).
    definition.pageBreakBefore = (node, nodes) => {
      if (node.id?.startsWith(ROUNDED_ID)) spans[node.id] = { page: node.startPosition.pageNumber, top: node.startPosition.top }
      if (node.id?.startsWith(SUMMARY_HEADING_ID)) {
        const bottom = node.startPosition.top + SUMMARY_HEADING_HEIGHT
        return !nodes.getFollowingNodesOnPage().some((next) => next.startPosition.top >= bottom - 0.5)
      }
      return false
    }
    return pdfMake.createPdf(definition).getBlob()
  }
  let blob = await render(null)
  // A document with rounded boxes is made again with their backgrounds and borders. The background
  // does not change the layout, so the boxes are where the first rendering measured them.
  if (Object.keys(spans).length) blob = await render(spans)
  return new File([blob], pdfFileName(document), { type: 'application/pdf' })
}
