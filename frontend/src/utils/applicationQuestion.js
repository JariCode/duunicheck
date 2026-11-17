// Decides whether a chat message is a short question about the selected application's own data
// (status, dates, events, reminder, notes), which DuuniCheck answers locally from its database
// without AI. Anything else goes to the AI assistant, so a request to write or edit something is
// never answered with the local fact list. When in doubt the message is not local.

// Maximum length of a local question; longer messages are requests for the AI.
export const maxLocalQuestionLength = 120

// The start of a word. JavaScript's \b only knows ASCII letters, so it would split Finnish words
// at ä and ö; this lookbehind treats every Unicode letter and digit as part of a word.
const wordStart = '(?<![\\p{L}\\p{N}])'
const wordEnd = '(?![\\p{L}\\p{N}])'
const startsWith = (stems) => new RegExp(`${wordStart}(?:${stems.join('|')})`, 'iu')
const wholeWord = (words) => new RegExp(`${wordStart}(?:${words.join('|')})${wordEnd}`, 'iu')

// Requests to write, edit or review something, and the documents such requests are about.
const editRequestStems = startsWith([
  'muokka',
  'muokat',
  'muutta',
  'muuta',
  'korjaa',
  'korjat',
  'kirjoit',
  'laadi',
  'laati',
  'paranna',
  'parann',
  'paranta',
  'lyhennä',
  'lyhent',
  'tiivistä',
  'tiivist',
  'lisää',
  'lisät',
  'poista',
  'poist',
  'vaihda',
  'vaihta',
  'tarkista',
  'tarkist',
  'arvioi',
  'arvioi',
  'ehdota',
  'ehdot',
  'käännä',
  'kääntä',
  'jatka',
  'jatko',
  'hakukirje',
  'kirje',
  'cv',
  'ilmoitu',
  // Asking for advice ("Miten vastaan haastattelussa…?") is for the AI, not a fact lookup.
  'miten',
  'kuinka',
  'auta',
  'neuvo',
  'voisitko',
])
// "tee" and "tehkää" only as whole words, so words such as "teema" are not requests.
const editRequestWords = wholeWord(['tee', 'tehkää', 'tekisitkö'])

// A question: it ends with a question mark or starts with a question or request word.
const questionStart = new RegExp(
  `^(?:mikä|mitkä|milloin|onko|olenko|mitä|missä|kerro|näytä|listaa)${wordEnd}`,
  'iu',
)

// The application's own data that the local answer contains.
const factStems = startsWith([
  'tila(?!u)',
  'vaihe',
  'milloin',
  'lähetetty',
  'lähetyspäiv',
  'lähetin',
  'lähettänyt',
  'vastauspäiv',
  'vastann',
  'haastattel',
  'tapahtum',
  'historia',
  'muistutu',
  'muistutus',
  'seuraava\\s+tehtäv',
  'muistiinpano',
])
const detailsWord = startsWith(['tiedot', 'tietoja'])
const thisApplication = startsWith(['hakemu', 'haku', 'hausta', 'tästä'])

export function isApplicationInfoQuestion(value) {
  const text = String(value || '').trim()
  if (!text || text.length > maxLocalQuestionLength) return false
  if (editRequestStems.test(text) || editRequestWords.test(text)) return false
  if (!(text.endsWith('?') || questionStart.test(text))) return false
  return factStems.test(text) || (detailsWord.test(text) && thisApplication.test(text))
}
