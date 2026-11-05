const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const fieldLabels = { company: 'Yritys', role: 'Tehtävä', place: 'Sijainti', link: 'Ilmoituksen linkki', cvId: 'CV', templateId: 'Hakemuspohja', applicationText: 'Hakemusteksti', status: 'Hakemuksen vaihe', respondedAt: 'Vastauspäivä', next: 'Seuraava tehtävä', nextDate: 'Muistutuspäivä', added: 'Lähetyspäivä', events: 'Tapahtumahistoria' }

function describeInvalidFields(details = []) {
  const labels = [...new Set(details.map((detail) => {
    const field = typeof detail === 'string' ? detail : detail?.field
    if (!field) return ''
    const [root, index, property] = String(field).split('.')
    if (root === 'events' && property) return `${fieldLabels.events}, kohta ${Number(index) + 1} (${property === 'date' ? 'päivämäärä' : property === 'type' ? 'tapahtuma' : 'tiedot'})`
    return fieldLabels[root] || root
  }).filter(Boolean))]
  return labels.length ? ` Tarkista: ${labels.join(', ')}.` : ''
}

export async function apiRequest(getToken, path, { method = 'GET', body } = {}) {
  const token = await getToken()
  if (!token) throw new Error('Kirjautumisistunto puuttuu. Kirjaudu uudelleen sisään.')
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const fieldHint = describeInvalidFields(payload.details)
    throw new Error((payload.error || `Pyyntö epäonnistui (${response.status}).`) + fieldHint)
  }
  return response.status === 204 ? null : response.json()
}
