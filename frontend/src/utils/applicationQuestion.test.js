// Run with: node --test src/utils (in the frontend folder)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isApplicationInfoQuestion, maxLocalQuestionLength } from './applicationQuestion.js'

const local = [
  'Mikä on hakemuksen tila?',
  'Milloin lähetin tämän hakemuksen?',
  'Onko yritys vastannut?',
  'Näytä tapahtumahistoria',
  'Kerro tämän hakemuksen tiedot',
  'Mitä muistiinpanoissa lukee?',
  'Mikä on seuraava tehtävä?',
  // Edge cases
  'Missä vaiheessa haku on?',
  'mikä on tilanne',
  'Milloin haastattelu on?',
  'Listaa tapahtumat',
  'Onko muistutusta asetettu?',
  '  Mikä on hakemuksen tila?  ',
  'Olenko jo lähettänyt hakemuksen?',
  'MIKÄ ON VASTAUSPÄIVÄ?',
]

const toAi = [
  'muokkaa hakukirjettä: Robot Frameworkin tuntemus antaa hyvän pohjan tehtävässä kehittymiselle. Englantia ei tarvitse mainita.',
  'Kirjoita hakukirje tähän tehtävään',
  'Tarkista CV:ni ja hakukirjeeni tätä ilmoitusta vasten.',
  'Käännä ilmoitus suomeksi',
  'jatka',
  'Mikä vaihe hakukirjeessä kannattaa muuttaa?',
  'Ehdota, miten kerron haastattelussa testirepostani',
  `Mikä on hakemuksen tila? ${'Kerro samalla vähän taustaa. '.repeat(5)}`,
  '',
  // Edge cases
  '   ',
  null,
  undefined,
  'Tee hakemuksen tilasta yhteenveto?',
  'Mikä on yrityksen nimi?',
  'Kerro jotain mukavaa',
  'Miten vastaan haastattelukysymykseen palkasta?',
  'Hakemuksen tila',
  'Jatka edellisestä',
  'Lyhennä vastausta, mikä on tila?',
  'Mitä tehtävässä tehdään?',
  'Paranna tekstiä: kerroin tilanteesta',
  'Mikä on CV:ni tila?',
  'Mitä ilmoituksessa lukee?',
]

for (const message of local) {
  test(`local: ${JSON.stringify(message)}`, () => {
    assert.equal(isApplicationInfoQuestion(message), true)
  })
}

for (const message of toAi) {
  test(`AI: ${String(JSON.stringify(message)).slice(0, 80)}`, () => {
    assert.equal(isApplicationInfoQuestion(message), false)
  })
}

test('the length limit is 120 characters', () => {
  // "Mikä on hakemuksen tila" padded with spaces inside, ending with "?": exactly 120 and 121 characters.
  const ofLength = (length) => `Mikä on hakemuksen${' '.repeat(length - 'Mikä on hakemuksen tila?'.length + 1)}tila?`
  assert.equal(maxLocalQuestionLength, 120)
  assert.equal(ofLength(120).length, 120)
  assert.equal(isApplicationInfoQuestion(ofLength(120)), true)
  assert.equal(isApplicationInfoQuestion(ofLength(121)), false)
})

test('words are matched from the start of a word, also next to ä and ö', () => {
  // "tehtävässä" alone is not a fact word, and "vastaus" in the middle of a word does not count.
  assert.equal(isApplicationInfoQuestion('Onko tehtävässä etätyötä?'), false)
  assert.equal(isApplicationInfoQuestion('Mikä on tilausten määrä?'), false)
  assert.equal(isApplicationInfoQuestion('Onko yrityksen vastausaika pitkä?'), false)
  assert.equal(isApplicationInfoQuestion('Mitä historiasta löytyy?'), true)
})
