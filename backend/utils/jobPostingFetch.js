import { lookup } from 'node:dns/promises'
import https from 'node:https'
import ipaddr from 'ipaddr.js'
import { convert } from 'html-to-text'

const MAX_BYTES = 500_000
const MAX_REDIRECTS = 3
const REQUEST_TIMEOUT_MS = 8_000
const BLOCKED_PUBLIC_SERVICE_IPS = new Set(['168.63.129.16'])
// Job boards whose robots.txt or data source forbids automated fetching. Subdomains are included.
const JOB_BOARDS = [
  { domain: 'duunitori.fi', name: 'Duunitori' },
  { domain: 'tyomarkkinatori.fi', name: 'Työmarkkinatori' },
]

export class BlockedJobBoardError extends Error {
  constructor() {
    super('Duunitorin ja Työmarkkinatorin ilmoituksia ei voi hakea automaattisesti. Kopioi ilmoituksen teksti ja liitä se apuriin.')
    this.name = 'BlockedJobBoardError'
  }
}

// Returns the job board name for a hostname, or '' when it is not a known job board.
export function jobBoardForHostname(value) {
  const hostname = String(value || '').toLowerCase().replace(/\.$/, '')
  return JOB_BOARDS.find(({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`))?.name || ''
}

export function isPublicAddress(value) {
  try {
    if (BLOCKED_PUBLIC_SERVICE_IPS.has(value) || !ipaddr.isValid(value)) return false
    return ipaddr.parse(value).range() === 'unicast'
  } catch { return false }
}

function parseSafeUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('URL ei ole kelvollinen.') }
  // Checked first and on every redirect hop, so a redirect cannot bypass the block.
  if (jobBoardForHostname(url.hostname)) throw new BlockedJobBoardError()
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Sallittu vain julkinen HTTPS-työpaikkasivu.')
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!hostname || hostname.endsWith('.localhost') || hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Työpaikkasivun osoite ei ole sallittu.')
  }
  const bareHostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  if (ipaddr.isValid(bareHostname) && !isPublicAddress(bareHostname)) {
    throw new Error('Työpaikkasivun osoite ei ole julkinen.')
  }
  if (BLOCKED_PUBLIC_SERVICE_IPS.has(bareHostname)) throw new Error('Työpaikkasivun osoite ei ole sallittu.')
  return url
}

async function resolvePublicAddresses(hostname) {
  const cleanHostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  if (ipaddr.isValid(cleanHostname)) {
    if (!isPublicAddress(cleanHostname)) throw new Error('Työpaikkasivun osoite ei ole julkinen.')
    const address = ipaddr.parse(cleanHostname)
    return [{ address: cleanHostname, family: address.kind() === 'ipv6' ? 6 : 4 }]
  }

  let dnsTimer
  const addresses = await Promise.race([
    lookup(cleanHostname, { all: true, verbatim: true }),
    new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('DNS-haku aikakatkaistiin.')), 3_000) }),
  ]).finally(() => clearTimeout(dnsTimer))
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Työpaikkasivun osoite ei ole julkinen.')
  }
  return addresses
}

function requestPage(url, addresses) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      agent: false,
      lookup: (_hostname, options, callback) => {
        if (options?.all) return callback(null, addresses)
        return callback(null, addresses[0].address, addresses[0].family)
      },
      headers: {
        Accept: 'text/html, application/xhtml+xml, text/plain;q=0.9',
        'Accept-Encoding': 'identity',
        'User-Agent': 'DuuniCheck/1.0 (job posting text reader)',
      },
    }, (response) => {
      const status = response.statusCode || 0
      const location = response.headers.location
      if (status >= 300 && status < 400 && location) {
        response.resume()
        return resolve({ redirect: location })
      }
      if (status < 200 || status >= 300) {
        response.resume()
        return reject(new Error('Työpaikkasivu ei vastannut onnistuneesti.'))
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase()
      const mediaType = contentType.split(';', 1)[0].trim()
      const contentEncoding = String(response.headers['content-encoding'] || 'identity').toLowerCase()
      const contentLength = Number(response.headers['content-length'])
      if (!['text/html', 'application/xhtml+xml', 'text/plain'].includes(mediaType) || contentEncoding !== 'identity' || (Number.isFinite(contentLength) && contentLength > MAX_BYTES)) {
        response.resume()
        return reject(new Error('Työpaikkasivun sisältömuotoa ei tueta.'))
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_BYTES) {
          response.destroy(new Error('Työpaikkasivu on liian suuri.'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve({ contentType, body: Buffer.concat(chunks).toString('utf8') }))
      response.on('aborted', () => reject(new Error('Työpaikkasivu keskeytti vastauksen.')))
      response.on('error', reject)
    })
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('Työpaikkasivun haku aikakatkaistiin.')))
    request.on('error', reject)
    request.end()
  })
}

export async function fetchJobPostingText(value) {
  let url = parseSafeUrl(value)
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const addresses = await resolvePublicAddresses(url.hostname)
    const page = await requestPage(url, addresses)
    if (page.redirect) {
      if (redirectCount === MAX_REDIRECTS) throw new Error('Työpaikkasivu ohjasi liian monta kertaa.')
      url = parseSafeUrl(new URL(page.redirect, url).href)
      continue
    }

    const text = page.contentType.includes('text/plain')
      ? page.body
      : convert(page.body, {
        wordwrap: false,
        selectors: [
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },
          { selector: 'noscript', format: 'skip' },
          { selector: 'svg', format: 'skip' },
          { selector: 'nav', format: 'skip' },
          { selector: 'footer', format: 'skip' },
        ],
      })
    const cleanText = text.replace(/\u0000/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 16_000)
    if (!cleanText) throw new Error('Työpaikkasivulta ei löytynyt luettavaa tekstiä.')
    return cleanText
  }
  throw new Error('Työpaikkasivua ei voitu lukea.')
}

export function isSafeJobPostingUrl(value) {
  try { parseSafeUrl(value); return true } catch { return false }
}
