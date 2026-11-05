export const stages = ['Kiinnostava', 'Lähetetty', 'Odottaa vastausta', 'Haastattelu', 'Tarjous', 'Hylätty']
export const sentTypes = ['Lähetetty', 'Hakemus jätetty']
export const responseTypes = ['Vastaus saatu', 'Haastattelu', 'Haastattelu sovittu', 'Haastattelu pidetty', 'Tarjous', 'Hylätty']
export const tone = (status) => ({ Kiinnostava: 'purple', Lähetetty: 'blue', 'Odottaa vastausta': 'gold', Haastattelu: 'green', Tarjous: 'coral', Hylätty: 'gray' }[status] || 'blue')
export const today = () => { const value = new Date(); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
export const daysFromToday = (days) => { const value = new Date(); value.setDate(value.getDate() + days); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
export const makeEvent = (type, date, note = '') => ({ id: Date.now() + Math.random(), type, date, note })
export const dateLabel = (value) => value ? new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value + 'T12:00:00')) : 'Ei päivämäärää'
export const safeHttpUrl = (value) => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : '' } catch { return '' } }
export const startingJobs = [
  { id: 1, company: 'Northstar Labs', role: 'Frontend Developer', place: 'Helsinki · hybridi', link: 'https://example.com/tyopaikka/northstar', cvId: 'cv-general', templateId: 'template-general', applicationText: 'Olen käyttöliittymien kehittämiseen keskittyvä frontend-kehittäjä. Northstarin tuote ja saavutettavien käyttöliittymien painotus kiinnostavat minua.', status: 'Haastattelu', added: daysFromToday(-3), next: 'Tekninen haastattelu', nextDate: daysFromToday(5), initial: 'N', color: 'blue', events: [makeEvent('Lähetetty', daysFromToday(-3)), makeEvent('Vastaus saatu', daysFromToday(-1), 'Kutsu tekniseen haastatteluun'), makeEvent('Haastattelu sovittu', daysFromToday(-1), 'Tekninen haastattelu sovittu')] },
  { id: 2, company: 'Polar Analytics', role: 'Product Designer', place: 'Espoo · hybridi', link: '', cvId: '', templateId: '', applicationText: '', status: 'Odottaa vastausta', added: daysFromToday(-7), next: 'Seuraa hakemuksen tilannetta', nextDate: daysFromToday(7), initial: 'P', color: 'coral', events: [makeEvent('Lähetetty', daysFromToday(-7))] },
  { id: 3, company: 'Kide Health', role: 'UX/UI Designer', place: 'Helsinki · etätyö', link: '', cvId: '', templateId: '', applicationText: '', status: 'Lähetetty', added: daysFromToday(-10), next: 'Odottaa vastausta', nextDate: '', initial: 'K', color: 'mint', events: [makeEvent('Lähetetty', daysFromToday(-10))] },
  { id: 4, company: 'Valo Mobility', role: 'Frontend Developer', place: 'Tampere · hybridi', link: '', cvId: '', templateId: '', applicationText: '', status: 'Haastattelu', added: daysFromToday(-14), next: 'Haastattelu pidetty', nextDate: '', initial: 'V', color: 'yellow', events: [makeEvent('Lähetetty', daysFromToday(-14)), makeEvent('Vastaus saatu', daysFromToday(-11)), makeEvent('Haastattelu pidetty', daysFromToday(-8), 'Ensimmäinen haastattelu pidetty')] },
]
export const startingCvs = [
  { id: 'cv-general', name: 'Yleinen CV', title: 'Frontend-kehittäjä', summary: 'Käyttöliittymien kehittämiseen keskittyvä ohjelmistokehittäjä. Pidän selkeistä tuotteista, saavutettavuudesta ja yhteistyöstä.', skills: 'React, JavaScript, TypeScript, CSS, saavutettavuus, käyttöliittymäsuunnittelu', experience: 'Frontend-kehittäjä · 2023–2026\nRakensin React-käyttöliittymiä ja tein yhteistyötä suunnittelun sekä tuotetiimin kanssa.', education: 'Tietojenkäsittelyn tradenomi · 2022' },
]
export const startingTemplates = [
  { id: 'template-general', name: 'Yleinen hakemuspohja', body: 'Hei,\n\nHaen tehtävää, koska yrityksenne työ ja avoimen roolin painotukset kiinnostavat minua. Kokemukseni käyttöliittymien kehittämisestä ja yhteistyöstä tuotetiimien kanssa sopii tehtävään hyvin.\n\nKerron mielelläni lisää osaamisestani haastattelussa.\n\nYstävällisin terveisin,\nJari' },
]
