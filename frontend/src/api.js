const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const fieldLabels = {
  company: 'Yritys',
  role: 'Tehtävä',
  place: 'Sijainti',
  link: 'Ilmoituksen linkki',
  cvId: 'CV',
  templateId: 'Hakemuspohja',
  applicationText: 'Hakemusteksti',
  notes: 'Muistiinpanot',
  status: 'Hakemuksen vaihe',
  respondedAt: 'Vastauspäivä',
  next: 'Seuraava tehtävä',
  nextDate: 'Muistutuspäivä',
  added: 'Lähetyspäivä',
  events: 'Tapahtumahistoria',
}

function describeInvalidFields(details = []) {
  const labels = [
    ...new Set(
      details
        .map((detail) => {
          const field = typeof detail === 'string' ? detail : detail?.field
          if (!field) return ''
          const [root, index, property] = String(field).split('.')
          if (root === 'events' && property)
            return `${fieldLabels.events}, kohta ${Number(index) + 1} (${property === 'date' ? 'päivämäärä' : property === 'type' ? 'tapahtuma' : 'tiedot'})`
          return fieldLabels[root] || root
        })
        .filter(Boolean),
    ),
  ]
  return labels.length ? ` Tarkista: ${labels.join(', ')}.` : ''
}

async function authToken(getToken) {
  const token = await getToken()
  if (!token) throw new Error('Kirjautumisistunto puuttuu. Kirjaudu uudelleen sisään.')
  return token
}

async function requestError(response) {
  const payload = await response.json().catch(() => ({}))
  const fieldHint = describeInvalidFields(payload.details)
  return new Error((payload.error || `Pyyntö epäonnistui (${response.status}).`) + fieldHint)
}

export async function apiRequest(getToken, path, { method = 'GET', body } = {}) {
  const token = await authToken(getToken)
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) throw await requestError(response)
  return response.status === 204 ? null : response.json()
}

export async function uploadMaterialFile(getToken, category, file) {
  const token = await authToken(getToken)
  const body = new FormData()
  body.append('category', category)
  body.append('file', file)
  const response = await fetch(`${API_URL}/api/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  if (!response.ok) throw await requestError(response)
  return response.json()
}

// Sends a file to be read into application drafts. The server stores neither the file nor the drafts.
export async function uploadImportFile(getToken, file) {
  const token = await authToken(getToken)
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(`${API_URL}/api/assistant/import-applications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  if (!response.ok) throw await requestError(response)
  return response.json()
}

export async function downloadMaterialFile(getToken, file) {
  const token = await authToken(getToken)
  const response = await fetch(`${API_URL}/api/files/${encodeURIComponent(file.id)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw await requestError(response)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
