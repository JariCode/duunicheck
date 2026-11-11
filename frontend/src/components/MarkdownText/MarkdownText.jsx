import './MarkdownText.css'
import { safeHttpUrl } from '../../utils'

// Renders the small Markdown subset AI answers use: headings, bullet and numbered lists,
// paragraphs, bold, italic, inline code and http(s) links. Everything is built as React elements
// from plain text, so HTML in the text is shown as text and never executed.

// Earliest inline token: `code`, **bold** / __bold__, *italic* / _italic_ or [text](url).
const inlinePattern =
  /`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|(?<![\p{L}\p{N}*])\*([^*\n]+)\*(?![\p{L}\p{N}*])|(?<![\p{L}\p{N}_])_([^_\n]+)_(?![\p{L}\p{N}_])|\[([^\]\n]+)\]\(([^)\s]+)\)/u

function renderInline(text, keyPrefix) {
  const nodes = []
  let rest = text
  let index = 0
  while (rest) {
    const match = rest.match(inlinePattern)
    if (!match) {
      nodes.push(rest)
      break
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const key = `${keyPrefix}-${index}`
    const [, code, bold, boldAlt, italic, italicAlt, linkText, linkUrl] = match
    if (code) nodes.push(<code key={key}>{code}</code>)
    else if (bold || boldAlt) nodes.push(<strong key={key}>{renderInline(bold || boldAlt, key)}</strong>)
    else if (italic || italicAlt) nodes.push(<em key={key}>{renderInline(italic || italicAlt, key)}</em>)
    else {
      // Only http(s) links become links; anything else (e.g. javascript:) stays as plain text.
      const href = safeHttpUrl(linkUrl)
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>
        ) : (
          `${linkText} (${linkUrl})`
        ),
      )
    }
    rest = rest.slice(match.index + match[0].length)
    index += 1
  }
  return nodes
}

const headingPattern = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/
const bulletPattern = /^\s*[-*+]\s+(.*)$/
const numberedPattern = /^\s*\d+[.)]\s+(.*)$/
const rulePattern = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

// Groups the lines into blocks: headings, lists, rules and paragraphs (separated by blank lines).
function parseBlocks(text) {
  const blocks = []
  let paragraph = []
  let list = null
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push(list)
    list = null
  }
  for (const line of String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')) {
    const heading = line.match(headingPattern)
    const bullet = line.match(bulletPattern)
    const numbered = line.match(numberedPattern)
    if (!line.trim()) {
      flushParagraph()
      flushList()
    } else if (rulePattern.test(line)) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'rule' })
    } else if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
    } else if (bullet || numbered) {
      flushParagraph()
      const type = bullet ? 'bullets' : 'numbers'
      if (list?.type !== type) {
        flushList()
        list = { type, items: [] }
      }
      list.items.push((bullet || numbered)[1])
    } else if (list && /^\s{2,}\S/.test(line)) {
      // An indented line continues the previous list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()
  return blocks
}

export default function MarkdownText({ text }) {
  return (
    <div className="markdown-text">
      {parseBlocks(text).map((block, blockIndex) => {
        const key = `block-${blockIndex}`
        if (block.type === 'rule') return <hr key={key} />
        if (block.type === 'heading') {
          const Heading = block.level <= 2 ? 'h3' : block.level === 3 ? 'h4' : 'h5'
          return <Heading key={key}>{renderInline(block.text, key)}</Heading>
        }
        if (block.type === 'bullets' || block.type === 'numbers') {
          const List = block.type === 'bullets' ? 'ul' : 'ol'
          return (
            <List key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </List>
          )
        }
        return (
          <p key={key}>
            {block.lines.map((line, lineIndex) => (
              <span key={`${key}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${key}-${lineIndex}`)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
