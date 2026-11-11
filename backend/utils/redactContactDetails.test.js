// Run with: node --test (in the backend folder)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  detectDocumentNames,
  knownContactDetails,
  redactContactDetails,
  redactDocuments,
  redactionMarker as R,
} from './redactContactDetails.js'

test('finds the name in a document without a Clerk name and removes it from every document', () => {
  const cv = 'Matti Meikäläinen\nmatti@example.fi\n\nKokemus: Ohjelmistokehittäjä 2020–2026'
  const letter = 'Hyvä vastaanottaja,\nMatin osaaminen sopii tehtävään.\n\nYstävällisin terveisin,\nMatti Meikäläinen'
  assert.deepEqual(detectDocumentNames(cv), ['Matti Meikäläinen'])
  const [cleanCv, cleanLetter] = redactDocuments([cv, letter], knownContactDetails({ clerkUser: null }))
  for (const text of [cleanCv, cleanLetter]) {
    assert.doesNotMatch(text, /Matti|Matin|Meikäläinen|@/u)
  }
  assert.equal(cleanCv, `${R} ${R}\n${R}\n\nKokemus: Ohjelmistokehittäjä 2020–2026`)
  assert.equal(
    cleanLetter,
    `Hyvä vastaanottaja,\n${R} osaaminen sopii tehtävään.\n\nYstävällisin terveisin,\n${R} ${R}`,
  )
})

test('removes the name after a closing', () => {
  const [clean] = redactDocuments(['Kiitos ajastanne.\n\nYstävällisin terveisin,\nMatti Meikäläinen'])
  assert.equal(clean, `Kiitos ajastanne.\n\nYstävällisin terveisin,\n${R} ${R}`)
  assert.deepEqual(detectDocumentNames('Best regards, Matti Meikäläinen'), ['Matti Meikäläinen'])
})

test('does not treat headings, greetings or companies on the first lines as names', () => {
  assert.deepEqual(detectDocumentNames('Hyvä Rekrytoija\nrekry@esimerkki.fi'), [])
  assert.deepEqual(detectDocumentNames('Esimerkki Oy\ninfo@esimerkki.fi'), [])
  // A capitalised line without contact details nearby is not a name.
  assert.deepEqual(detectDocumentNames('Ohjelmistokehittäjä Helsinki\n\nHaen tehtävää.'), [])
})

test('takes names from an email address of the form first.last', () => {
  const known = knownContactDetails({
    clerkUser: { emailAddresses: [{ emailAddress: 'matti.meikäläinen@example.fi' }] },
  })
  assert.equal(redactContactDetails('Meikäläisen portfolio ja Matti', known), `${R} portfolio ja ${R}`)
})

test('removes inflected forms of the surname Meikäläinen', () => {
  assert.equal(
    redactContactDetails('Meikäläisen ja Meikäläiselle sekä meikäläiselle', { names: ['Meikäläinen'] }),
    `${R} ja ${R} sekä ${R}`,
  )
})

test('removes postal addresses', () => {
  assert.equal(redactContactDetails('Esimerkkikatu 5 A 12\n00100 Helsinki'), `${R}\n${R}`)
  assert.equal(redactContactDetails('Esimerkkikatu 5 A 12, 00100 Helsinki'), R)
  assert.equal(redactContactDetails('Osoite:\nFI-33100 Tampere, Suomi'), `Osoite:\n${R}`)
})

test('keeps an ordinary cover letter without personal data exactly as it is', () => {
  const text = [
    '### Hakemus: Ohjelmistokehittäjä',
    '',
    'Haen Esimerkki Oy:n ohjelmistokehittäjän tehtävää. Minulla on viiden vuoden kokemus',
    'React- ja Node.js-kehityksestä sekä **ASP.NET Core** -taustajärjestelmistä.',
    '',
    '- Onnistunut siirto pilveen vuonna 2024',
    '- Toivottavasti pääsen kertomaan lisää haastattelussa.',
  ].join('\n')
  const [clean] = redactDocuments([text], { names: ['Onni', 'Toivo'] })
  assert.equal(clean, text)
})

test('removes email addresses', () => {
  assert.equal(redactContactDetails('Ota yhteyttä: matti.m+tyo@esimerkki.fi.'), `Ota yhteyttä: ${R}.`)
  assert.equal(redactContactDetails('ÄÄKKÖNEN@yritys-oy.com'), R)
})

test('removes Finnish and international phone numbers', () => {
  for (const phone of [
    '+358 40 123 4567',
    '+358401234567',
    '+358-40-123-4567',
    '040 123 4567',
    '040-123 4567',
    '0401234567',
    '09 1234 567',
    '(09) 123 4567',
  ]) {
    assert.equal(redactContactDetails(`Puh. ${phone}, kiitos`), `Puh. ${R}, kiitos`, phone)
  }
})

test('removes web addresses', () => {
  assert.equal(
    redactContactDetails('Profiili https://www.linkedin.com/in/matti-m/ ja muuta'),
    `Profiili ${R} ja muuta`,
  )
  assert.equal(redactContactDetails('Katso www.esimerkki.fi.'), `Katso ${R}.`)
  assert.equal(redactContactDetails('Koodi: github.com/mattim'), `Koodi: ${R}`)
  assert.equal(redactContactDetails('linkedin.com/in/matti'), R)
})

test('removes the user name and its inflected forms as whole words', () => {
  const known = { names: ['Matti Virtanen'] }
  assert.equal(redactContactDetails('Terveisin Matti Virtanen', known), `Terveisin ${R} ${R}`)
  assert.equal(redactContactDetails('Matin kokemus ja matille sopiva', known), `${R} kokemus ja ${R} sopiva`)
  assert.equal(redactContactDetails('Virtasen tiimi ja Virtaselle', known), `${R} tiimi ja ${R}`)
  // A word that only contains the name in the middle stays.
  assert.equal(redactContactDetails('Amatti ja Mattit', known), 'Amatti ja Mattit')
})

test('keeps ordinary words that only start like a name', () => {
  const known = { names: ['Onni', 'Toivo', 'Anna', 'Kivi', 'Salo'] }
  const text = 'Projekti oli onnistunut, toivottavasti annan lisää. Kivijalka ja salonki säilyvät.'
  assert.equal(redactContactDetails(text, known), text)
})

test('removes inflected names', () => {
  const known = { names: ['Onni', 'Toivo', 'Anna', 'Virtanen', 'Matti'] }
  assert.equal(
    redactContactDetails('Onnin, Toivolle, Annalla, Virtasen ja Matin kanssa', known),
    `${R}, ${R}, ${R}, ${R} ja ${R} kanssa`,
  )
  assert.equal(redactContactDetails('Annallekin ja Virtaselta', known), `${R} ja ${R}`)
})

test('keeps technology names that look like domains', () => {
  const text = 'Kokemusta: ASP.NET Core, VB.NET, Socket.IO ja Node.js.'
  assert.equal(redactContactDetails(text), text)
})

test('removes lowercase bare domains and www addresses', () => {
  assert.equal(
    redactContactDetails('Sivut esimerkki.fi, www.esimerkki.fi ja linkedin.com/in/nimi.'),
    `Sivut ${R}, ${R} ja ${R}.`,
  )
})

test('removes contact values saved in the user CVs and templates', () => {
  const known = knownContactDetails({
    clerkUser: {
      firstName: 'Matti',
      lastName: 'Meikäläinen',
      emailAddresses: [{ emailAddress: 'matti@example.org' }],
    },
    cvs: [{ fullName: 'Matti Meikäläinen', phone: '+358 40 123 4567', portfolio: 'https://esimerkki.fi/portfolio' }],
  })
  assert.equal(
    redactContactDetails('Matti Meikäläinen, +358401234567, esimerkki.fi/portfolio, matti@example.org', known),
    `${R} ${R}, ${R}, ${R}, ${R}`,
  )
})

test('keeps text that contains no contact details', () => {
  const text =
    'Haen tehtävää Nokia Oyj:ssä vuonna 2026. Kokemusta 5 vuotta, palkkatoive 4 000 €. ' +
    'Haastattelu 01.02.2026 klo 10–11, osoite 00100 Helsinki. Node.js ja React 19.'
  assert.equal(redactContactDetails(text, { names: ['Matti Meikäläinen'] }), text)
})

test('does not touch empty input', () => {
  assert.equal(redactContactDetails(''), '')
  assert.equal(redactContactDetails(undefined), '')
})
