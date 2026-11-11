export const stages = ['Kiinnostava', 'Lähetetty', 'Haastattelu sovittu', 'Hyväksytty', 'Hylätty']
export const normalizeStage = (status) =>
  ({ 'Odottaa vastausta': 'Lähetetty', Haastattelu: 'Haastattelu sovittu', Tarjous: 'Lähetetty' })[status] || status
export const eventTypes = [
  'Hakemus jätetty',
  'Lähetetty',
  'Vastaus saatu',
  'Haastattelu sovittu',
  'Haastattelu pidetty',
  'Tarjous',
  'Hyväksytty',
  'Hylätty',
  'Muu tapahtuma',
]
export const sentTypes = ['Lähetetty', 'Hakemus jätetty']
export const responseTypes = [
  'Vastaus saatu',
  'Haastattelu',
  'Haastattelu sovittu',
  'Haastattelu pidetty',
  'Tarjous',
  'Hyväksytty',
  'Hylätty',
]
export const firstResponseDate = (events = []) =>
  events
    .filter((event) => responseTypes.includes(event.type) && event.date)
    .map((event) => event.date)
    .sort()[0] || ''
export const tone = (status) =>
  ({
    Kiinnostava: 'applications',
    Lähetetty: 'sent',
    'Haastattelu sovittu': 'interviews',
    Hyväksytty: 'accepted',
    Hylätty: 'rejected',
  })[normalizeStage(status)] || 'applications'
export const today = () => {
  const value = new Date()
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const makeEvent = (type, date, note = '') => ({ id: Date.now() + Math.random(), type, date, note })
export const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value + 'T12:00:00'),
      )
    : 'Ei päivämäärää'
export const safeHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}
