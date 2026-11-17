// The old application text (applicationText, up to 20 000 characters) has no field of its own in
// the app. When an application is loaded, the text is moved into the notes if it fits there
// (notes: up to 8 000 characters, the same limit as the server); the next save then stores it as
// notes and clears applicationText. A text that does not fit is kept as it is: every save sends it
// back unchanged and the details view shows it read-only as "Vanha hakemusteksti". User text is
// never dropped.
export const NOTES_MAX_LENGTH = 8000
export const APPLICATION_TEXT_HEADING = 'Hakemusteksti:'

// Returns the notes the app shows and the applicationText a save sends: '' when the text was
// moved into the notes (or there is none), otherwise the original text, which also means that
// the details view shows it as the old application text.
export function applicationTextState(job) {
  const notes = job?.notes || ''
  const stored = job?.applicationText || ''
  const text = stored.trim()
  // No text, or the notes already contain it (an earlier move): nothing to add.
  if (!text || notes.includes(text)) return { notes, applicationText: '' }
  const merged = notes.trim() ? `${notes}\n\n${APPLICATION_TEXT_HEADING}\n${stored}` : stored
  // The server trims before it checks the length.
  if (merged.trim().length <= NOTES_MAX_LENGTH) return { notes: merged, applicationText: '' }
  return { notes, applicationText: stored }
}

// The applicationText a save sends: the value kept in the app's state by applicationTextState, never
// an empty text in place of an old application text that was not moved into the notes.
export const savedApplicationText = (job) => job?.applicationText || ''
