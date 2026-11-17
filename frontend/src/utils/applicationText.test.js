// Run with: node --test src/utils (in the frontend folder)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applicationTextState, NOTES_MAX_LENGTH, savedApplicationText } from './applicationText.js'

// What App.jsx does: the loaded application gets applicationTextState, the edit form copies the
// notes and applicationText from it (the user may edit the notes) and apiApplication sends
// savedApplicationText.
const load = (job) => ({ ...job, ...applicationTextState(job) })
const save = (state, form = {}) => ({ notes: state.notes, ...form, applicationText: savedApplicationText({ ...state, ...form }) })

test('a) only an application text: shown as the notes, the save moves it and clears applicationText', () => {
  const job = { notes: '', applicationText: 'Hei,\n\nhaen tehtävää.' }
  const state = load(job)
  assert.equal(state.notes, 'Hei,\n\nhaen tehtävää.')
  assert.equal(state.applicationText, '')
  assert.deepEqual(save(state), { notes: 'Hei,\n\nhaen tehtävää.', applicationText: '' })
})

test('b) notes and an application text: joined under "Hakemusteksti:", the save moves it', () => {
  const state = load({ notes: 'Soita rekrytoijalle.', applicationText: 'Hei,\nhaen tehtävää.' })
  assert.equal(state.notes, 'Soita rekrytoijalle.\n\nHakemusteksti:\nHei,\nhaen tehtävää.')
  assert.deepEqual(save(state), { notes: state.notes, applicationText: '' })
  // The user can still edit the notes in the form; the text stays in what is sent.
  const sent = save(state, { notes: `${state.notes}\nLisäys.` })
  assert.ok(sent.notes.includes('Hakemusteksti:\nHei,\nhaen tehtävää.'))
  assert.equal(sent.applicationText, '')
})

test('c) an application text already in the notes is not added twice', () => {
  const moved = 'Soita rekrytoijalle.\n\nHakemusteksti:\nHei,\nhaen tehtävää.'
  const state = load({ notes: moved, applicationText: '  Hei,\nhaen tehtävää.\n' })
  assert.equal(state.notes, moved)
  assert.deepEqual(save(state), { notes: moved, applicationText: '' })
  // Loading again after the move changes nothing.
  assert.deepEqual(applicationTextState(save(state)), { notes: moved, applicationText: '' })
})

test('d) over 8 000 characters: not moved, the save sends the original text, the view shows it', () => {
  const long = 'x'.repeat(NOTES_MAX_LENGTH + 1)
  const alone = load({ notes: '', applicationText: long })
  assert.deepEqual([alone.notes, alone.applicationText], ['', long])
  assert.deepEqual(save(alone), { notes: '', applicationText: long })

  // Together over the limit, each part alone under it: the notes stay the user's own.
  const notes = 'Muistiinpano.'
  const text = 'y'.repeat(NOTES_MAX_LENGTH - notes.length)
  const both = load({ notes, applicationText: text })
  assert.deepEqual([both.notes, both.applicationText], [notes, text])
  // Editing the notes in the form never empties the old application text.
  assert.deepEqual(save(both, { notes: 'Uusi muistiinpano.' }), { notes: 'Uusi muistiinpano.', applicationText: text })

  // Exactly at the limit (after trimming, like the server) it is still moved.
  const exact = 'z'.repeat(NOTES_MAX_LENGTH)
  assert.deepEqual(applicationTextState({ notes: '', applicationText: `${exact}\n` }), { notes: `${exact}\n`, applicationText: '' })
})

test('e) no application text: unchanged, the save sends an empty applicationText', () => {
  for (const applicationText of [undefined, '', '  \n ']) {
    const state = load({ notes: 'Oma muistiinpano.', applicationText })
    assert.equal(state.notes, 'Oma muistiinpano.')
    assert.deepEqual(save(state), { notes: 'Oma muistiinpano.', applicationText: '' })
  }
  assert.deepEqual(applicationTextState({}), { notes: '', applicationText: '' })
  assert.equal(savedApplicationText({}), '')
})
