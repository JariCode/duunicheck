// Finnish texts for Clerk errors, shared by Clerk's own components (the localization in Root.jsx)
// and the app's own sign-up form, which receives raw Clerk API errors with English messages.
import { fiFI } from '@clerk/localizations'

// Messages that @clerk/localizations is missing (Clerk would show its English server message) and
// fixes for awkward or ungrammatical translations. The wrong-password messages do not reveal
// whether the email address has an account.
const accountNotFound = 'Tiliä ei löytynyt näillä tiedoilla.'

export const finnishErrorFixes = {
  // Missing from fiFI
  form_password_incorrect: 'Sähköpostiosoite tai salasana on väärä. Yritä uudelleen.',
  form_code_incorrect: 'Koodi on väärä. Tarkista koodi ja yritä uudelleen.',
  form_param_nil: 'Täytä kaikki pakolliset kentät.',
  form_param_format_invalid: 'Tieto on väärässä muodossa. Tarkista se ja yritä uudelleen.',
  form_param_value_invalid: 'Arvo ei kelpaa. Tarkista tieto ja yritä uudelleen.',
  form_param_type_invalid: 'Tieto on väärää tyyppiä. Tarkista se ja yritä uudelleen.',
  form_param_type_invalid__email_address: 'Anna kelvollinen sähköpostiosoite.',
  form_param_type_invalid__phone_number: 'Anna kelvollinen puhelinnumero.',
  form_param_max_length_exceeded: 'Tieto on liian pitkä. Lyhennä sitä.',
  form_password_compromised__sign_in:
    'Salasanasi on saattanut vaarantua. Kirjaudu toisella tavalla ja vaihda salasana kirjautumisen jälkeen.',
  form_identifier_exists: 'Tämä tieto on jo käytössä toisella tilillä. Kokeile toista.',
  form_username_invalid_character: 'Käyttäjänimessä on merkkejä, joita ei voi käyttää.',
  external_account_not_found: 'Tällä kirjautumistavalla ei löytynyt tiliä. Kirjaudu toisella tavalla.',
  ticket_expired_code: 'Linkki on vanhentunut. Aloita alusta tai pyydä uusi linkki.',
  ticket_invalid_code: 'Linkki ei ole enää voimassa, tai sitä on jo käytetty. Aloita alusta tai pyydä uusi linkki.',
  protect_check_required:
    'Kirjautuminen vaatii lisätarkistuksen, jota ei voi näyttää tässä. Yritä uudelleen tai kirjaudu toisella tavalla.',
  protect_check_aborted: 'Tarkistus keskeytyi. Yritä uudelleen.',
  protect_check_already_resolved: 'Tarkistus on jo tehty. Jatka eteenpäin.',
  too_many_unverified_identifications:
    'Tilillä on liian monta vahvistamatonta tunnistetta. Poista tarpeettomat vahvistamattomat sähköpostiosoitteet tai puhelinnumerot ja yritä uudelleen.',
  too_many_requests: 'Liian monta yritystä. Odota hetki ja yritä uudelleen.',
  user_locked: 'Tili on lukittu liian monen epäonnistuneen kirjautumisyrityksen vuoksi. Yritä myöhemmin uudelleen.',
  user_banned: 'Tämän tilin käyttö on estetty.',
  user_deactivated: 'Tili on poistettu käytöstä.',
  strategy_for_user_invalid: 'Tällä tilillä ei voi kirjautua valitulla tavalla. Kirjaudu toisella tavalla.',
  not_allowed_to_sign_up: 'Tällä sähköpostiosoitteella ei voi luoda tiliä.',
  sign_up_restricted_waitlist: 'Rekisteröityminen ei ole tällä hetkellä avoinna.',
  signup_rate_limit_exceeded: 'Tilejä on luotu liian monta lyhyessä ajassa. Yritä myöhemmin uudelleen.',
  external_account_exists: 'Tämä kirjautumistili on jo liitetty toiseen tiliin. Kirjaudu sillä tilillä.',
  invitation_account_not_exists: 'Kutsuun liittyvää tiliä ei löytynyt. Pyydä uusi kutsu.',
  device_blocked: 'Kirjautuminen tältä laitteelta on estetty. Kokeile toista laitetta tai ota yhteyttä tukeen.',
  form_password_compromised: 'Salasana on saattanut vaarantua. Valitse toinen salasana.',
  captcha_missing_token: 'Tietoturvatarkistus ei valmistunut. Päivitä sivu ja yritä uudelleen.',
  resource_not_found: 'Tietoa ei löytynyt. Se on voinut vanhentua. Päivitä sivu ja yritä uudelleen.',

  // Awkward, ungrammatical or wrong in fiFI
  form_identifier_not_found: accountNotFound,
  // Invite-only mode: an uninvited Google account gets the same message as an unknown email address.
  sign_up_mode_restricted: accountNotFound,
  form_param_format_invalid__email_address: 'Sähköpostiosoitteen on oltava kelvollinen.',
  form_param_format_invalid__phone_number: 'Puhelinnumeron on oltava kelvollisessa kansainvälisessä muodossa.',
  form_password_or_identifier_incorrect:
    'Sähköpostiosoite tai salasana on väärä. Yritä uudelleen tai kirjaudu toisella tavalla.',
  form_password_validation_failed: 'Salasana on väärä.',
  // fiFI says "vähintään 8 merkkiä", but the length comes from the Clerk instance settings.
  form_password_length_too_short: 'Salasana on liian lyhyt.',
  form_password_pwned__sign_in:
    'Salasana on löytynyt julkisesta tietovuodosta, eikä sitä voi enää käyttää. Vaihda salasana.',
  form_password_size_in_bytes_exceeded: 'Salasana on liian pitkä. Lyhennä sitä tai poista joitakin erikoismerkkejä.',
  form_username_needs_non_number_char: 'Käyttäjänimessä on oltava vähintään yksi muu merkki kuin numero.',
  captcha_invalid:
    'Rekisteröityminen epäonnistui, koska tietoturvatarkistus ei mennyt läpi. Päivitä sivu ja yritä uudelleen tai ota yhteyttä tukeen.',
  captcha_unavailable:
    'Rekisteröityminen epäonnistui, koska robottitarkistusta ei voitu tehdä. Päivitä sivu ja yritä uudelleen tai ota yhteyttä tukeen.',
  identification_deletion_failed: 'Et voi poistaa tilin viimeistä sähköpostiosoitetta tai puhelinnumeroa.',
}

// Password strength warnings shown when changing the password: "ovat helppo arvata" is ungrammatical.
export const finnishPasswordWarningFixes = {
  commonNames: 'Yleisiä etu- ja sukunimiä on helppo arvata.',
  dates: 'Päivämääriä on helppo arvata.',
  extendedRepeat: 'Toistuvia merkkejä on helppo arvata.',
  namesByThemselves: 'Pelkkiä nimiä on helppo arvata.',
  recentYears: 'Viime vuosien vuosilukuja on helppo arvata.',
  sequences: 'Peräkkäisiä numeroita ja kirjaimia on helppo arvata.',
  simpleRepeat: 'Toistuvia merkkejä on helppo arvata.',
  straightRow: 'Näppäimistöllä vierekkäisiä merkkejä on helppo arvata.',
}

// Errors Clerk's own components translate through unstable__errors (see Root.jsx).
export const finnishUnstableErrors = {
  ...fiFI.unstable__errors,
  ...finnishErrorFixes,
  zxcvbn: {
    ...fiFI.unstable__errors.zxcvbn,
    warnings: { ...fiFI.unstable__errors.zxcvbn.warnings, ...finnishPasswordWarningFixes },
  },
}

// API error codes the sign-up, invitation, email code and password reset flows return that have no
// localization key in Clerk's components.
const formOnlyErrors = {
  form_identifier_exists__email_address: 'Tällä sähköpostiosoitteella on jo tili. Kirjaudu sisään.',
  duplicate_email: 'Tällä sähköpostiosoitteella on jo tili. Kirjaudu sisään.',
  verification_expired: 'Koodi on vanhentunut. Pyydä uusi koodi.',
  verification_failed: 'Vahvistus epäonnistui. Pyydä uusi koodi ja yritä uudelleen.',
}

const snakeCase = (value) => String(value || '').replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
const asText = (value) => (typeof value === 'string' ? value : '')

/**
 * Finnish text for a Clerk error (ClerkError with errors[], a single API error or a global error).
 * Unknown codes give the fallback, never Clerk's English message.
 * @param {unknown} error
 * @param {{ fallback: string, passwordMinLength?: number | null }} options
 */
export function clerkErrorText(error, { fallback, passwordMinLength = null }) {
  const first = (Array.isArray(error) ? error[0] : error?.errors?.[0]) || error
  const code = String(first?.code || '')
  if (code === 'form_password_length_too_short' && passwordMinLength) {
    return `Salasanan on oltava vähintään ${passwordMinLength} merkkiä.`
  }
  const paramName = snakeCase(first?.meta?.paramName)
  const text =
    asText(formOnlyErrors[`${code}__${paramName}`]) ||
    asText(finnishUnstableErrors[`${code}__${paramName}`]) ||
    asText(formOnlyErrors[code]) ||
    asText(finnishUnstableErrors[code])
  if (text) return text
  // Only the code is logged, so a missing translation can be added later.
  if (code) console.warn('Clerk error code without a Finnish text:', code)
  return fallback
}
