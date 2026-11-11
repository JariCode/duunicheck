// Data minimisation (GDPR Art. 5) for text sent to the AI assistant: contact details in documents
// are replaced with a marker before the text leaves the server. The user's own chat message is not
// passed through this function.
//
// Removed:
// - email addresses
// - phone numbers that start with + or 0 and have 7–15 digits (e.g. +358 40 123 4567, 040-1234567)
// - web addresses: http(s)://… and www.… in any letter case, and bare lowercase domains such as
//   esimerkki.fi or linkedin.com/in/name (technology names like ASP.NET or Socket.IO stay)
// - the user's names as whole words, optionally followed by Finnish case endings, possessive
//   suffixes and clitics ("Matti", "Matin", "Matillekin"). Simple consonant gradation (Matti → Matin)
//   and the -nen surname stem (Virtanen → Virtasen) are covered. A capitalised word is always a
//   name; a lowercase word only when it is exactly the name or the name with an ending of two or
//   more letters, so ordinary words such as "annan" or "onnistunut" stay
// - contact values saved in the user's CVs and templates when they appear literally in the text
// - postal addresses: a line with a Finnish postal code and town, and the street line above it
// - names found in the documents themselves (first lines and signature), see detectDocumentNames
//
// Detection is pattern based, so it cannot catch everything (for example a street address the user
// has not saved anywhere). The privacy policy tells the user to check a file before selecting it.

export const redactionMarker = '[poistettu]'

const emailPattern = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu

// Addresses with an explicit scheme or www. are links in any letter case.
const explicitUrlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/giu

// A bare domain counts as a link only in lowercase, so ASP.NET, VB.NET and Socket.IO are kept.
const bareDomainPattern =
  /(?<![\p{L}\p{N}.-])(?:[a-z0-9-]+\.)+(?:com|fi|net|org|io|dev|me|app|eu|se|info|co|ai)(?![\p{L}\p{N}-])(?:\/[^\s<>"')\]]*)?/gu

// A candidate starts with +, 0 or (0 and continues with digits, spaces, dashes and brackets.
// Dates (01.02.2026), years (2026) and postal codes (00100) do not reach 7 digits or contain dots.
const phoneCandidatePattern = /(?<![\p{L}\p{N}+(])(?:\+|\(?0)[\d\s()-]{5,}\d(?![\p{L}\p{N}])/gu

// Punctuation right after a link usually ends the sentence and is kept outside the marker.
const trailingPunctuation = /[.,;:!?]+$/u

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const letters = '\\p{L}'

// Finnish endings allowed after a name: a case ending, then a possessive suffix, then a clitic,
// each optional (e.g. Mati-lle-ni-kin).
const caseEndings = [
  'n',
  'a',
  'ä',
  'ta',
  'tä',
  'lle',
  'lla',
  'llä',
  'lta',
  'ltä',
  'ssa',
  'ssä',
  'sta',
  'stä',
  'an',
  'en',
  'in',
  'on',
  'un',
  'yn',
  'än',
  'ön',
  'hin',
  'ksi',
  'na',
  'nä',
  'tta',
  'ttä',
]
const possessiveSuffixes = ['ni', 'si', 'nsa', 'nsä', 'mme', 'nne']
const clitics = ['kin', 'kaan', 'kään', 'han', 'hän']
const ending = `(?:${caseEndings.join('|')})?(?:${possessiveSuffixes.join('|')})?(?:${clitics.join('|')})?`
// -nen surnames inflect through -se- / -s-: Virtanen → Virtasen, Virtaselle, Virtasta.
const nenStemEnding = `(?:e(?:${caseEndings.join('|')})|t[aä])(?:${possessiveSuffixes.join('|')})?(?:${clitics.join('|')})?`

// The stems a name can take: the name itself, the weak grade of a double k/p/t before the last
// vowel (Matti → Mati-n, Pekka → Peka-n) and the -nen stem (Virtanen → Virtas-en).
function nameForms(name) {
  const forms = [`${escapeRegExp(name)}${ending}`]
  const gradation = name.match(/^(.*)([kpt])\2([aeiouyäö])$/iu)
  if (gradation) {
    const [, start, consonant, vowel] = gradation
    forms.push(`${escapeRegExp(start + consonant + vowel)}(?:${caseEndings.join('|')})${ending}`)
  }
  if (/nen$/iu.test(name) && name.length > 5) forms.push(`${escapeRegExp(name.slice(0, -3))}s${nenStemEnding}`)
  return forms
}

// Replaces a name only as a whole word. A capitalised word is a name with any allowed ending;
// a lowercase word only when it is the name itself or has an ending of two or more letters,
// because one-letter endings turn many names into ordinary words (anna → annan, kivi → kivia).
function redactName(text, name) {
  const pattern = new RegExp(`(?<![${letters}])(?:${nameForms(name).join('|')})(?![${letters}])`, 'giu')
  return text.replace(pattern, (word) => {
    const capitalised = word[0] !== word[0].toLowerCase()
    const extra = word.length - name.length
    return capitalised || extra === 0 || extra >= 2 ? redactionMarker : word
  })
}

function splitNames(names) {
  const parts = names
    .flatMap((name) => String(name || '').split(/[\s,-]+/u))
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
  return [...new Set(parts.map((part) => part.toLowerCase()))]
}

function redactPhones(text) {
  return text.replace(phoneCandidatePattern, (match) => {
    const digits = match.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15 ? redactionMarker : match
  })
}

// Removes a literally saved contact value; for phone numbers any spacing between digits matches.
function redactLiteral(text, value) {
  const trimmed = String(value || '').trim()
  if (trimmed.length < 4) return text
  const digits = trimmed.replace(/\D/g, '')
  const looksLikePhone = /^[+\d\s()-]+$/.test(trimmed) && digits.length >= 7
  const pattern = looksLikePhone
    ? new RegExp(`\\+?${digits.split('').join('[\\s()-]*')}`, 'g')
    : new RegExp(escapeRegExp(trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '')), 'gi')
  return text.replace(pattern, redactionMarker)
}

// --- Postal addresses ------------------------------------------------------------------------

// A line that is only a Finnish postal code and a town: "00100 Helsinki", "FI-33100 Tampere, Suomi".
const postalLinePattern =
  /^\s*(?:FI-?)?\d{5}\s+\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?\s*(?:,\s*(?:Suomi|Finland))?\s*$/u
// A street address line: words and a number, optionally a staircase and flat ("Esimerkkikatu 5 A 12").
const streetLinePattern = /^\s*\p{Lu}[\p{L}.-]*(?:\s+\p{L}[\p{L}.-]*)*\s+\d+\s*[A-Za-z]?(?:\s*\d+)?\s*,?\s*$/u
// Street and postal code on one line: "Esimerkkikatu 5 A 12, 00100 Helsinki".
const streetAndPostalPattern =
  /^\s*\p{Lu}[\p{L}.-]*(?:\s+\p{L}[\p{L}.-]*)*\s+\d+[^,\n]*,\s*(?:FI-?)?\d{5}\s+\p{Lu}[\p{L}-]+.*$/u

// Replaces postal address lines; the street line above a postal code line goes with it.
function redactPostalAddresses(text) {
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    if (streetAndPostalPattern.test(lines[index])) {
      lines[index] = redactionMarker
    } else if (postalLinePattern.test(lines[index])) {
      lines[index] = redactionMarker
      if (index > 0 && streetLinePattern.test(lines[index - 1])) lines[index - 1] = redactionMarker
    }
  }
  return lines.join('\n')
}

// --- Names found in the document itself --------------------------------------------------------

// 1–4 words that each start with a capital letter followed by lowercase letters, nothing else.
const nameLinePattern = /^\s*(\p{Lu}[\p{Ll}'’-]+(?:\s+\p{Lu}[\p{Ll}'’-]+){0,3})\s*[,.]?\s*$/u
// Words that make a capitalised line a heading, a greeting or a company instead of a name.
const notNameWords = new Set([
  'ab',
  'ansioluettelo',
  'arvoisa',
  'avoin',
  'cover',
  'curriculum',
  'cv',
  'dear',
  'hakemus',
  'hakukirje',
  'hei',
  'hello',
  'hyvä',
  'inc',
  'ky',
  'letter',
  'ltd',
  'moi',
  'oy',
  'oyj',
  'resume',
  'ry',
  'tmi',
  'työhakemus',
  'vitae',
])
const closingPattern =
  /^\s*(ystävällisin terveisin|parhain terveisin|terveisin|kiitos|best regards|kind regards|regards|yours sincerely|sincerely)\b[\s,.!:-]*(.*)$/iu

const contactProbes = [
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+\.\p{L}{2,}/u,
  /(?:\+|\b0)[\d\s()-]{6,}\d/u,
  /\b(?:https?:\/\/|www\.)|(?<![\p{L}\p{N}.-])[a-z0-9-]+\.(?:com|fi|net|org|io|dev|me|app|eu|se)\b/u,
  /(?:^|\s)(?:FI-?)?\d{5}\s+\p{Lu}/u,
]
const hasContactDetails = (line) => contactProbes.some((probe) => probe.test(line))

function nameFromLine(line, minimumWords) {
  const match = line.match(nameLinePattern)
  if (!match) return ''
  const words = match[1].split(/\s+/u)
  if (words.length < minimumWords || words.some((word) => notNameWords.has(word.toLowerCase()))) return ''
  return match[1]
}

// Finds the user's name where documents put it: a name-only line among the first six lines with
// contact details nearby, and name-only lines right after a closing such as "Ystävällisin terveisin".
// Only these two places are checked, so ordinary text is never treated as a name.
export function detectDocumentNames(text) {
  if (!text) return []
  const lines = String(text).split('\n')
  const found = []
  const firstLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim())
    .slice(0, 6)
  for (const { line, index } of firstLines) {
    const name = nameFromLine(line, 2)
    const nearby = lines.slice(Math.max(0, index - 3), index + 4)
    if (name && nearby.some(hasContactDetails)) found.push(name)
  }
  lines.forEach((line, index) => {
    const closing = line.match(closingPattern)
    if (!closing) return
    const sameLineName = closing[2] && nameFromLine(closing[2], 1)
    if (sameLineName) found.push(sameLineName)
    for (const next of lines
      .slice(index + 1)
      .filter((candidate) => candidate.trim())
      .slice(0, 2)) {
      const name = nameFromLine(next, 1)
      if (!name) break
      found.push(name)
    }
  })
  return [...new Set(found)]
}

/**
 * @param {string} text Document text to send to the AI.
 * @param {{ names?: string[], contacts?: string[] }} known The user's names and saved contact values.
 */
export function redactContactDetails(text, { names = [], contacts = [] } = {}) {
  if (!text) return text || ''
  let result = redactPostalAddresses(String(text))
  result = result.replace(emailPattern, redactionMarker)
  const markLink = (match) => redactionMarker + (match.match(trailingPunctuation)?.[0] || '')
  result = result.replace(explicitUrlPattern, markLink)
  result = result.replace(bareDomainPattern, markLink)
  for (const contact of contacts) result = redactLiteral(result, contact)
  result = redactPhones(result)
  for (const name of splitNames(names)) result = redactName(result, name)
  return result
}

// Redacts every document of one AI request. A name found in any document (see
// detectDocumentNames) is removed from all of them, so a name read from a CV's first line also
// disappears from the cover letter.
export function redactDocuments(texts, known = {}) {
  const detectedNames = texts.flatMap(detectDocumentNames)
  const allKnown = { ...known, names: [...(known.names || []), ...detectedNames] }
  return texts.map((text) => redactContactDetails(text, allKnown))
}

// "matti.meikalainen@…" or "matti_meikalainen@…" gives the names Matti and Meikalainen.
function namesFromEmail(email) {
  const local = String(email || '').split('@')[0]
  return /^\p{L}{2,}[._]\p{L}{2,}$/u.test(local) ? local.split(/[._]/u) : []
}

// Collects the user's names and saved contact values from Clerk and the user's CVs and templates.
// Clerk names are optional; without them the names come from the CVs, templates, email addresses
// and the documents themselves.
export function knownContactDetails({ clerkUser, cvs = [], templates = [] }) {
  const sources = [...cvs, ...templates]
  const emails = [
    ...(clerkUser?.emailAddresses || []).map((entry) => entry.emailAddress),
    ...sources.map((item) => item.email),
  ].filter(Boolean)
  return {
    names: [
      clerkUser?.firstName,
      clerkUser?.lastName,
      ...sources.map((item) => item.fullName),
      ...emails.flatMap(namesFromEmail),
    ].filter(Boolean),
    contacts: [
      ...emails,
      ...(clerkUser?.phoneNumbers || []).map((entry) => entry.phoneNumber),
      ...sources.flatMap((item) => [item.phone, item.linkedin, item.github, item.portfolio, item.website]),
    ].filter(Boolean),
  }
}
