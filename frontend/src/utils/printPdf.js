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

// border-radius 2mm: the CV contact box and columns and the letter's address row. pdfmake's table
// fills and lines are square, so a rounded box lays out its content in a table without fill or
// lines (the border widths are added to the padding, so the size stays the same) between two
// zero-size markers. The first rendering measures where the markers are (see createPrintPdf), and
// the second paints the background and borders underneath as rounded shapes (roundedBackground).
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

// A CSS box with border-radius 2mm. `rounded` collects what roundedBackground paints: the box's
// left edge and width on the page (x, width), background and borders.
function roundedBox(rounded, content, { padding = [0, 0, 0, 0], border = {}, fill, x, width, ...rest }) {
  const id = `${ROUNDED_ID}${rounded.length}`
  const sides = Object.fromEntries(
    ['top', 'right', 'bottom', 'left'].map((name) => {
      const [size, color] = border[name] || [0, null]
      return [name, [borderWidth(size), color]]
    }),
  )
  rounded.push({ id, x, width, fill, border: sides })
  const [top, right, bottom, left] = padding
  return measuredBlock(
    id,
    box(content, {
      padding: [top + sides.top[0], right + sides.right[0], bottom + sides.bottom[0], left + sides.left[0]],
    }),
    rest,
  )
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

// .print-cv: 8pt / 1.32, padding 10mm 12mm.
const CV_PAGE_X = mm(12)
const CV_PAGE_Y = mm(10)
// @page { margin: 0 }: the document's top padding is only on the first page, and a page that
// continues the document starts at the top edge of the paper, as in Chrome's print.
const NO_PAGE_MARGIN_Y = 0
const A4_HEIGHT = 841.89
const NO_BORDER = { top: [0, null], right: [0, null], bottom: [0, null], left: [0, null] }
// List items are not paragraphs, so they keep the document colour #252331.
const CV_ITEM = { size: 7.2, lineHeight: 1.25, color: '#252331' }

// .print-cv .print-section h2: 8.2pt / 1.1, border-bottom 0.8pt #9273b2, padding-bottom 0.8mm,
// margin-bottom 1.3mm.
function cvSectionHeading(title) {
  return box(text(title, { size: 8.2, lineHeight: 1.1, weight: 700, color: '#493267' }), {
    padding: [0, 0, mm(0.8), 0],
    border: { bottom: [0.8, '#9273b2'] },
    margin: [0, 0, 0, mm(1.3)],
  })
}

function bulletItems(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*[•*-]\s*/, '').trim())
    .filter(Boolean)
}

// A list with padding-left 3.5mm and li padding-left 0.3mm. The marker is Chrome's outside disc:
// diameter 0.3125em, about 1.44em before the text, centred on the first line. `gap` is the grid gap
// between items (0.45mm in the sidebar; the two-column lists in the main column have none).
function cvList(items, { indent = mm(3.5) + mm(0.3), gap = 0 } = {}) {
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

// In the main column the list is split into two CSS columns (column-gap 6mm) filled top to bottom.
// The list's 3.5mm padding is only on the left of the first column, so the second column's markers
// sit in the gap: each half is the column plus 3.5mm, and the gap between them is 6mm - 3.5mm.
function cvBulletSection(title, value, { twoColumns = false } = {}) {
  const items = bulletItems(value)
  if (!items.length) return null
  const half = Math.ceil(items.length / 2)
  return {
    stack: [
      cvSectionHeading(title),
      twoColumns
        ? { columns: [cvList(items.slice(0, half)), cvList(items.slice(half))], columnGap: mm(6) - mm(3.5) }
        : cvList(items, { gap: mm(0.45) }),
    ],
    unbreakable: true,
  }
}

function cvExperience(value) {
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
        text(heading, { size: 7.6, lineHeight: 1.18, weight: 700, color: '#30233e', margin: [0, 0, 0, mm(0.5)] }),
        details.length > 0 && text(details.join('\n'), { size: 7.1, lineHeight: 1.22, color: '#393642' }),
      ].filter(Boolean),
      unbreakable: true,
      // .cv-experience-list { gap: 1.8mm }
      margin: [0, 0, 0, index < entries.length - 1 ? mm(1.8) : 0],
    }
  })
  // The heading stays on the same page as the first entry.
  return { stack: [{ stack: [cvSectionHeading('Työkokemus'), articles[0]], unbreakable: true }, ...articles.slice(1)] }
}

// Sections stacked with the given bottom margin. In the sidebar the last one has none
// (:last-child); in the main column `.print-cv .cv-print-main .print-section` comes later in
// PrintSheet.css with the same specificity, so the last section keeps its 2.8mm.
function sectionStack(sections, gap, { lastMargin = 0 } = {}) {
  const present = sections.filter(Boolean)
  present.forEach((section, index) => {
    section.margin = [0, 0, 0, index < present.length - 1 ? gap : lastMargin]
  })
  return { stack: present }
}

function cvContent(cv, photo) {
  const links = profileLinks(cv)
  const rounded = []
  const heroTextWidth = PAGE_WIDTH - 2 * CV_PAGE_X - (photo ? mm(27) + mm(8) : 0)

  // .cv-print-hero: grid (1fr auto), gap 8mm, centred; padding 10mm 12mm 5mm; border-bottom 1mm.
  const heroText = {
    stack: [
      text(cv.fullName || '', { size: 23, lineHeight: 1.05, weight: 700, color: '#242037', letterSpacing: px(-0.8) }),
      cv.title && text(cv.title, { size: 10, lineHeight: 1.32, weight: 700, color: '#67468f', margin: [0, mm(1.5), 0, 0] }),
      // max-width: 138mm, as a right margin in the text column.
      cv.summary &&
        text(cv.summary, {
          size: 8,
          lineHeight: 1.32,
          color: '#484451',
          margin: [0, mm(2), Math.max(0, heroTextWidth - mm(138)), 0],
        }),
    ].filter(Boolean),
    verticalAlignment: 'middle',
  }
  const heroCells = [heroText]
  if (photo) {
    // 27 x 34 mm; object-fit: cover and the 1.5mm border-radius are already in the image (pdfPhoto).
    heroCells.push({ image: photo, width: mm(27), height: mm(34), verticalAlignment: 'middle' })
  }
  // The band reaches the page edges, so it cancels the page margins. The bottom border is one
  // rectangle, because per-cell table lines leave a visible seam where the cells meet.
  const hero = {
    stack: [
      {
        table: { widths: photo ? ['*', mm(27)] : ['*'], body: [heroCells] },
        layout: {
          ...noLines,
          fillColor: () => '#f2eff8',
          paddingLeft: (index) => (index === 0 ? CV_PAGE_X : mm(8)),
          paddingRight: (index, node) => (index === node.table.widths.length - 1 ? CV_PAGE_X : 0),
          paddingTop: () => CV_PAGE_Y,
          paddingBottom: () => mm(5),
        },
      },
      { canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_WIDTH, h: borderWidth(mm(1)), color: '#7954aa' }] },
    ],
    margin: [-CV_PAGE_X, 0, -CV_PAGE_X, mm(4)],
    unbreakable: true,
  }

  // .cv-print-contact: grid (auto 1fr), gap 1.5mm 6mm, padding 2.5mm 3.5mm, border 1px #dcd2e8,
  // border-left 1.5mm #7954aa, border-radius 2mm, background #f8f6fb, margin-bottom 3mm. Each item:
  // label 6pt/800 uppercase, gap 0.5mm, value 7.2pt/700.
  const contactItem = (label, value, link) => ({
    width: 'auto',
    stack: [
      text(label.toUpperCase(), { size: 6, lineHeight: 1.32, weight: 800, color: '#7550a8', letterSpacing: px(0.6) }),
      text(value, { size: 7.2, lineHeight: 1.32, weight: 700, color: '#302440', link, margin: [0, mm(0.5), 0, 0] }),
    ],
  })
  const contactItems = [
    cv.email && contactItem('Sähköposti', cv.email, `mailto:${cv.email}`),
    cv.phone && contactItem('Puhelin', cv.phone, `tel:${cv.phone.replace(/[^+\d]/g, '')}`),
  ].filter(Boolean)
  const contact = contactItems.length
    ? roundedBox(
        rounded,
        {
          table: {
            widths: ['auto', '*'],
            body: [
              [
                { ...text('Yhteystiedot', { size: 8, lineHeight: 1.32, weight: 700, color: '#493267' }), verticalAlignment: 'middle' },
                { columns: contactItems, columnGap: mm(6), verticalAlignment: 'middle' },
              ],
            ],
          },
          layout: { ...noLines, paddingLeft: (index) => (index === 1 ? mm(6) : 0) },
        },
        {
          padding: [mm(2.5), mm(3.5), mm(2.5), mm(3.5)],
          border: {
            top: [px(1), '#dcd2e8'],
            right: [px(1), '#dcd2e8'],
            bottom: [px(1), '#dcd2e8'],
            left: [mm(1.5), '#7954aa'],
          },
          fill: '#f8f6fb',
          margin: [0, 0, 0, mm(3)],
          x: CV_PAGE_X,
          width: PAGE_WIDTH - 2 * CV_PAGE_X,
        },
      )
    : null

  // .print-links: gap 1mm; label 7pt/700, link 6.7pt, line-height 1.2, gap 0.2mm.
  const linkList = {
    stack: links.map(([label, url], index) => ({
      stack: [
        text(label, { size: 7, lineHeight: 1.2, weight: 700, color: '#393340' }),
        text(displayUrl(url), { size: 6.7, lineHeight: 1.2, color: '#4f3b70', link: url, margin: [0, mm(0.2), 0, 0] }),
      ],
      margin: [0, 0, 0, index < links.length - 1 ? mm(1) : 0],
    })),
  }

  // Section gaps: 2.4mm in the sidebar, 2.8mm in the main column.
  const sidebar = sectionStack(
    [
      cvBulletSection('IT-taidot', cv.skills),
      cvBulletSection('Kielitaito', cv.languages),
      links.length > 0 && { stack: [cvSectionHeading('Linkit'), linkList], unbreakable: true },
    ],
    mm(2.4),
  )
  const main = sectionStack(
    [
      cvExperience(cv.experience),
      cvBulletSection('Koulutus', cv.education, { twoColumns: true }),
      cvBulletSection('Sertifikaatit', cv.certificates, { twoColumns: true }),
      cvBulletSection('Kurssit', cv.courses, { twoColumns: true }),
      cv.hobbies && {
        stack: [cvSectionHeading('Harrastukset'), text(cv.hobbies, { ...CV_ITEM, color: '#393642' })],
        unbreakable: true,
      },
    ],
    mm(2.8),
    { lastMargin: mm(2.8) },
  )

  // .cv-print-columns: 53mm sidebar (padding 4mm, #f6f4f9), column-gap 7mm, main column
  // (padding 4mm, #fbf9fd), both with border-radius 2mm. Both columns are as tall as the taller one.
  // The top and bottom padding are margins of the content, so a page that continues the columns
  // starts at the top edge without padding, like Chrome's sliced boxes. The backgrounds are painted
  // by roundedBackground, also down to the bottom edge of a page where the columns continue.
  sidebar.margin = [0, mm(4), 0, mm(4)]
  main.margin = [0, mm(4), 0, mm(4)]
  const columnsId = `${ROUNDED_ID}columns`
  rounded.push(
    { id: columnsId, x: CV_PAGE_X, width: mm(53), fill: '#f6f4f9', border: NO_BORDER },
    { id: columnsId, x: CV_PAGE_X + mm(60), width: PAGE_WIDTH - 2 * CV_PAGE_X - mm(60), fill: '#fbf9fd', border: NO_BORDER },
  )
  const columns = measuredBlock(columnsId, {
    table: {
      widths: [mm(53) - mm(8), mm(7), '*'],
      body: [[sidebar, { text: '' }, main]],
    },
    layout: {
      ...noLines,
      paddingLeft: (column) => (column === 1 ? 0 : mm(4)),
      paddingRight: (column) => (column === 1 ? 0 : mm(4)),
    },
  })

  return {
    pageMargins: [CV_PAGE_X, NO_PAGE_MARGIN_Y, CV_PAGE_X, NO_PAGE_MARGIN_Y],
    content: [hero, contact, columns].filter(Boolean),
    rounded,
  }
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
  const rounded = []

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

  // .letter-sender: name 23pt/700 and title 10pt/700 on the left, contact lines 8.5pt on the right
  // (gap 1.5mm), centred vertically; padding-bottom 5mm, border-bottom 1px #ded9e7.
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
              stack: contact.map((item, index) =>
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

  // .letter-address-row: recipient on the left, date on the right, centred vertically; margin
  // 6mm 0 8mm, padding 4mm 5mm, border 1px #e2d9ec, border-left 2mm #7954aa, border-radius 2mm,
  // background #f8f6fb.
  const recipient = (job.company || job.place) && {
    stack: [
      // .letter-recipient is a grid with gap 1mm.
      letterLabel('Vastaanottaja', { margin: [0, 0, 0, mm(1.5) + mm(1)] }),
      job.company && text(job.company, { size: 11, lineHeight: 1.55, weight: 700, color: '#393642' }),
      job.place && text(job.place, { size: 10, lineHeight: 1.55, color: '#393642', margin: [0, job.company ? mm(1) : 0, 0, 0] }),
    ].filter(Boolean),
    verticalAlignment: 'middle',
  }
  // With only the date in the row it sits on the left, as in the flex row of the print view.
  const dateAlignment = recipient ? 'right' : 'left'
  const dateBlock = {
    stack: [
      letterLabel('Päiväys', { alignment: dateAlignment }),
      text(date, { size: 8.5, lineHeight: 1.55, color: '#63596d', alignment: dateAlignment }),
    ],
    verticalAlignment: 'middle',
  }
  const addressRow =
    (job.company || job.place || job.role || !job) &&
    roundedBox(
      rounded,
      {
        table: {
          widths: recipient ? ['*', 'auto'] : ['*'],
          body: [recipient ? [recipient, dateBlock] : [dateBlock]],
        },
        layout: { ...noLines, paddingLeft: (index) => (index === 1 ? mm(10) : 0) },
      },
      {
        padding: [mm(4), mm(5), mm(4), mm(5)],
        border: {
          top: [px(1), '#e2d9ec'],
          right: [px(1), '#e2d9ec'],
          bottom: [px(1), '#e2d9ec'],
          left: [mm(2), '#7954aa'],
        },
        fill: '#f8f6fb',
        margin: [0, mm(6), 0, mm(8)],
        x: LETTER_PAGE_X,
        width: contentWidth,
      },
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
    content: [titlebar, sender, addressRow, ...(role || []), { stack: bodyBlocks }, linksFooter].filter(Boolean),
    rounded,
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
  return named('Muistiinpanot', String(document?.title || '').replace(/^Muistiinpanot\s*·?\s*/, ''))
}

export function pdfTitle(document) {
  const kind = document?.kind || 'notes'
  if (kind === 'cv') return document.cv?.fullName ? `CV – ${document.cv.fullName}` : 'CV'
  if (kind === 'application') return document.job?.company ? `Hakemus – ${document.job.company}` : 'Hakemus'
  return document?.title || 'DuuniCheck'
}

// spans: where the markers of the rounded boxes were in a previous rendering ({ [id]: { page, top } }).
// Without them the rounded boxes are laid out but not painted.
export async function buildPdfDefinition(document, spans = null) {
  const kind = document?.kind || 'notes'
  let definition
  if (kind === 'cv') {
    const cv = document.cv || {}
    definition = cvContent(cv, await pdfPhoto(cv.photo))
  } else if (kind === 'application') {
    // Link widths are measured with the app's DM Sans, so the weights must be loaded first.
    await Promise.all(['400 10pt "DM Sans"', '700 10pt "DM Sans"'].map((font) => window.document.fonts?.load(font)))
    definition = applicationContent(document)
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
  const render = async (measured) => {
    const definition = await buildPdfDefinition(document, measured)
    // Called after layout for every node; records where the markers of the rounded boxes ended up.
    // Never adds a break.
    definition.pageBreakBefore = (node) => {
      if (node.id?.startsWith(ROUNDED_ID)) spans[node.id] = { page: node.startPosition.pageNumber, top: node.startPosition.top }
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
