const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

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
    throw new Error(payload.error || `Pyyntö epäonnistui (${response.status}).`)
  }
  return response.status === 204 ? null : response.json()
}
