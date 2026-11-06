export const legalUpdated = '6. marraskuuta 2026'
export const controllerName = 'JariCode (jaricode.fi)'

const configuredEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || ''
export const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ? configuredEmail : ''
export const supportText = supportEmail || 'Ota yhteyttä sovelluksen kehittäjään'

export const providers = [
  { name: 'Domainhotelli', purpose: 'Sovelluksen verkkosivujen hosting', location: 'Suomi' },
  { name: 'Render', purpose: 'Palvelinpuolen (backend) hosting', location: 'Yhdysvallat' },
  { name: 'MongoDB Atlas', purpose: 'Tietokanta', location: 'Ruotsi (EU)' },
  { name: 'Clerk', purpose: 'Käyttäjätilit ja kirjautuminen', location: 'Yhdysvallat' },
  { name: 'OpenAI', purpose: 'Tekoälyavustajan vastaukset', location: 'Yhdysvallat' },
  { name: 'Google', purpose: 'Valinnainen Google-kirjautuminen', location: 'Yhdysvallat' },
]
