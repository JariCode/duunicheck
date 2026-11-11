import { useEffect, useRef, useState } from 'react'
import { useSignUp } from '@clerk/react'
import { withBasePath } from '../../utils/basePath.js'
import { clerkErrorText } from '../../clerk/finnishClerkErrors.js'
import './CustomSignUp.css'

const appBasePath = import.meta.env.BASE_URL
const signUpSsoCallbackPath = withBasePath('sign-up/sso-callback')

const signUpFallback = 'Tilin luonti ei onnistunut. Tarkista tiedot ja yritä uudelleen.'
const invitationFallback =
  'Kutsua ei voitu käyttää. Se on ehkä peruttu, vanhentunut tai jo käytetty. Jos olet jo luonut tilin, kirjaudu sisään.'
// Clerk's own default when the instance setting cannot be read.
const defaultPasswordMinLength = 8

// The minimum password length from the Clerk instance settings. clerk-js exposes them only through
// an undocumented property, so it is read defensively and may be missing.
function environmentPasswordMinLength() {
  const minLength = Number(window.Clerk?.__unstable__environment?.userSettings?.passwordSettings?.min_length)
  return Number.isInteger(minLength) && minLength > 0 ? minLength : null
}

// When the setting is not available, Clerk's "too short" error tells the length ("… 15 characters …").
function minLengthFromError(error) {
  const first = (Array.isArray(error) ? error[0] : error?.errors?.[0]) || error
  if (first?.code !== 'form_password_length_too_short') return null
  const length = Number(String(first.longMessage || first.message || '').match(/\d+/)?.[0])
  return Number.isInteger(length) && length > 0 ? length : null
}

// Missing sign-up fields the details view can ask for. protect_check and email verification
// are handled by their own views.
const supportedDetailFields = ['first_name', 'last_name', 'legal_accepted', 'password']
const handledElsewhere = ['protect_check', 'email_address']
const fieldNames = {
  email_address: 'sähköpostiosoite',
  phone_number: 'puhelinnumero',
  username: 'käyttäjänimi',
}

export default function CustomSignUp({ inviteTicket = '', continueSso = false }) {
  const { signUp, errors, fetchStatus } = useSignUp()
  const isReady = fetchStatus !== 'fetching'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [code, setCode] = useState(() => Array(6).fill(''))
  const [accepted, setAccepted] = useState(false)
  const [view, setView] = useState(continueSso ? 'details' : 'form')
  const [missingFields, setMissingFields] = useState([])
  // The id of the sign-up that already got its automatic code. A ref is set synchronously, so a parallel
  // call cannot send a second code for the same sign-up; a new sign-up (different id) gets its own code.
  const codeSentForRef = useRef('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [learnedMinLength, setLearnedMinLength] = useState(null)
  const passwordMinLength = environmentPasswordMinLength() || learnedMinLength || defaultPasswordMinLength
  const errorFallback = inviteTicket ? invitationFallback : signUpFallback
  // Clerk API errors are shown in Finnish by error code; Clerk's English messages are never shown.
  const errorText = (error) => {
    const learned = minLengthFromError(error)
    if (learned) setLearnedMinLength(learned)
    return clerkErrorText(error, { fallback: errorFallback, passwordMinLength: learned || passwordMinLength })
  }
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [now, setNow] = useState(0)
  const codeInputs = useRef([])

  useEffect(() => {
    if (!resendAvailableAt || resendAvailableAt <= Date.now()) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [resendAvailableAt])

  // OAuth can return here with a sign-up that still needs required profile fields.
  // Clerk owns that flow state; read it after the callback has hydrated.
  useEffect(() => {
    if (!continueSso || !isReady || signUp?.status !== 'complete') return
    void signUp
      .finalize({
        navigate: ({ decorateUrl }) => window.location.assign(decorateUrl(appBasePath)),
      })
      .then(({ error }) => {
        if (error) setMessage(clerkErrorText(error, { fallback: signUpFallback }))
      })
      .catch((error) => setMessage(clerkErrorText(error, { fallback: signUpFallback })))
  }, [continueSso, isReady, signUp, signUp?.status])

  const currentMissingFields =
    continueSso && signUp?.status === 'missing_requirements' ? signUp.missingFields : missingFields
  // A field the details view cannot show would leave an empty form, so it is reported instead.
  const unsupportedFields = currentMissingFields.filter(
    (field) => !supportedDetailFields.includes(field) && !handledElsewhere.includes(field),
  )
  const unsupportedFieldsKey = unsupportedFields.join(',')
  useEffect(() => {
    if (unsupportedFieldsKey) {
      console.warn('Clerk sign-up asks for fields the form does not support:', unsupportedFieldsKey)
    }
  }, [unsupportedFieldsKey])
  const protectCheckMissing =
    continueSso && signUp?.status === 'missing_requirements' && signUp.missingFields.includes('protect_check')
  const currentView =
    continueSso && errors?.global
      ? 'form'
      : continueSso && isReady && signUp?.status === 'missing_requirements'
        ? signUp.missingFields.includes('protect_check')
          ? 'form'
          : signUp.unverifiedFields.includes('email_address')
            ? 'code'
            : 'details'
        : continueSso && (!isReady || !signUp || signUp.status !== 'missing_requirements')
          ? 'loading'
          : view

  async function finishSignUp() {
    if (signUp.status !== 'complete') return
    const { error } = await signUp.finalize({
      navigate: ({ decorateUrl }) => window.location.assign(decorateUrl(appBasePath)),
    })
    if (error) throw error
  }

  async function inspectSignUp({ sendCode = true } = {}) {
    if (signUp.status === 'complete') {
      await finishSignUp()
      return
    }
    if (signUp.status === 'abandoned') {
      setMessage('Tilin luonti keskeytyi. Aloita uudelleen.')
      setView('form')
      return
    }

    const missing = signUp.missingFields || []
    setMissingFields(missing)
    if (missing.includes('protect_check')) {
      setView('form')
      setMessage(
        'Clerkin turvallisuustarkistus ei käynnistynyt. Päivitä sivu ja yritä uudelleen. Jos ongelma jatkuu, tarkista Clerk-sovelluksen suojausasetukset.',
      )
      return
    }
    if (signUp.unverifiedFields.includes('email_address')) {
      setView('code')
      const signUpId = signUp.id
      if (sendCode && codeSentForRef.current !== signUpId) {
        // Locked before the request; released if it fails, so the next attempt can send the code.
        codeSentForRef.current = signUpId
        let error
        try {
          ;({ error } = await signUp.verifications.sendEmailCode())
        } catch (sendError) {
          error = sendError
        }
        if (error) {
          if (codeSentForRef.current === signUpId) codeSentForRef.current = ''
          throw error
        }
        setResendAvailableAt(Date.now() + 30_000)
        setNow(Date.now())
      }
      return
    }

    if (missing.length) {
      setView('details')
      return
    }
    setMessage(
      'Clerk ei vielä saanut tilin luontia valmiiksi. Tarkista Clerk-tilin rekisteröintiasetukset ja yritä uudelleen.',
    )
  }

  async function submitSignUp(event) {
    event.preventDefault()
    if (!isReady || !signUp || busy) return
    if (!accepted) {
      setMessage('Hyväksy käyttöehdot ja tietosuojaseloste ennen tilin luontia.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      // The invitation already contains the email address, so only the password is asked.
      const { error } = inviteTicket
        ? await signUp.ticket({ ticket: inviteTicket, password, legalAccepted: true })
        : await signUp.password({ emailAddress: email.trim(), password, legalAccepted: true })
      if (error) throw error
      await inspectSignUp()
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function submitDetails(event) {
    event.preventDefault()
    if (!isReady || !signUp || busy) return
    setBusy(true)
    setMessage('')
    try {
      const updates = {}
      // Same list as the view: on /sign-up/continue the local state is empty and Clerk's list applies.
      if (currentMissingFields.includes('first_name')) updates.firstName = firstName.trim()
      if (currentMissingFields.includes('last_name')) updates.lastName = lastName.trim()
      if (currentMissingFields.includes('legal_accepted')) updates.legalAccepted = accepted
      if (currentMissingFields.includes('password')) updates.password = password
      const { error } = await signUp.update(updates)
      if (error) throw error
      await inspectSignUp()
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event) {
    event.preventDefault()
    if (!isReady || !signUp || busy) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code: code.join('') })
      if (error) throw error
      await inspectSignUp({ sendCode: false })
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    if (!isReady || !signUp || busy || resendAvailableAt > now) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await signUp.verifications.sendEmailCode()
      if (error) throw error
      setMessage('Uusi vahvistuskoodi lähetettiin sähköpostiisi.')
      setResendAvailableAt(Date.now() + 30_000)
      setNow(Date.now())
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  function updateCodeDigit(index, value) {
    const digits = value.replace(/\D/g, '').slice(0, 6 - index)
    if (digits.length > 1) {
      const next = [...code]
      digits.split('').forEach((digit, offset) => {
        next[index + offset] = digit
      })
      setCode(next)
      codeInputs.current[Math.min(index + digits.length, 5)]?.focus()
      return
    }
    const digit = digits.slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    if (digit && index < 5) codeInputs.current[index + 1]?.focus()
  }

  function handleCodePaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    event.preventDefault()
    setCode(Array.from({ length: 6 }, (_, index) => pasted[index] || ''))
    codeInputs.current[Math.min(pasted.length, 5)]?.focus()
  }

  async function continueWithGoogle() {
    if (!isReady || !signUp || busy) return
    if (!accepted) {
      setMessage('Hyväksy käyttöehdot ja tietosuojaseloste ennen tilin luontia.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await signUp.sso({
        strategy: 'oauth_google',
        redirectUrl: appBasePath,
        redirectCallbackUrl: signUpSsoCallbackPath,
        legalAccepted: true,
      })
      if (error) throw error
    } catch (error) {
      setMessage(errorText(error))
      setBusy(false)
    }
  }

  return (
    <div className="custom-signup">
      {currentView === 'loading' ? (
        <p className="custom-signup-intro" role="status">
          Viimeistellään Google-kirjautumista…
        </p>
      ) : currentView === 'form' ? (
        <>
          <h2>{inviteTicket ? 'Luo kutsutili' : 'Luo DuuniCheck-tili'}</h2>
          <p className="custom-signup-intro">
            {inviteTicket ? 'Viimeistele kutsun hyväksyminen.' : 'Luo tili sähköpostiosoitteella tai Googlella.'}
          </p>
          {!inviteTicket && (
            <>
              <button
                type="button"
                className="custom-signup-google"
                onClick={continueWithGoogle}
                disabled={!isReady || busy}
              >
                Jatka Googlella
              </button>
              <div className="custom-signup-divider">
                <span>tai sähköpostilla</span>
              </div>
            </>
          )}
          <form onSubmit={submitSignUp}>
            {!inviteTicket && (
              <label>
                Sähköpostiosoite
                <input
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            <label>
              Salasana
              <input
                type="password"
                autoComplete="new-password"
                minLength={passwordMinLength}
                aria-describedby="password-length-hint"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <small id="password-length-hint" className="custom-signup-hint">
                Vähintään {passwordMinLength} merkkiä.
              </small>
            </label>
            <label className="custom-signup-consent">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                Olen lukenut ja hyväksyn <a href={withBasePath('kayttoehdot')}>käyttöehdot</a> ja{' '}
                <a href={withBasePath('tietosuojaseloste')}>tietosuojaselosteen</a>.
              </span>
            </label>
            <button className="custom-signup-submit" type="submit" disabled={!isReady || busy}>
              {busy ? 'Luodaan tiliä…' : inviteTicket ? 'Hyväksy kutsu' : 'Luo tili'}
            </button>
          </form>
        </>
      ) : currentView === 'details' ? (
        <>
          <h2>Täydennä tilin tiedot</h2>
          <p className="custom-signup-intro">Clerk tarvitsee nämä tiedot tilin luomista varten.</p>
          <form onSubmit={submitDetails}>
            {currentMissingFields.includes('first_name') && (
              <label>
                Etunimi
                <input
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </label>
            )}
            {currentMissingFields.includes('last_name') && (
              <label>
                Sukunimi
                <input
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </label>
            )}
            {currentMissingFields.includes('password') && (
              <label>
                Salasana
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={passwordMinLength}
                  aria-describedby="password-length-hint"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <small id="password-length-hint" className="custom-signup-hint">
                  Vähintään {passwordMinLength} merkkiä.
                </small>
              </label>
            )}
            {unsupportedFields.length > 0 && (
              <p className="custom-signup-message" role="alert">
                Clerk pyytää tietoa, jota tämä lomake ei osaa kysyä:{' '}
                {unsupportedFields.map((field) => fieldNames[field] || field).join(', ')}. Tiliä ei voi luoda ennen kuin
                Clerk-sovelluksen rekisteröintiasetukset korjataan. Ota yhteyttä palvelun ylläpitäjään.
              </p>
            )}
            {currentMissingFields.includes('legal_accepted') && (
              <label className="custom-signup-consent">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                <span>
                  Olen lukenut ja hyväksyn <a href={withBasePath('kayttoehdot')}>käyttöehdot</a> ja{' '}
                  <a href={withBasePath('tietosuojaseloste')}>tietosuojaselosteen</a>.
                </span>
              </label>
            )}
            <button
              className="custom-signup-submit"
              type="submit"
              disabled={
                !isReady ||
                busy ||
                unsupportedFields.length > 0 ||
                (currentMissingFields.includes('legal_accepted') && !accepted)
              }
            >
              {busy ? 'Tallennetaan…' : 'Jatka'}
            </button>
          </form>
        </>
      ) : (
        <>
          <h2>Vahvista sähköpostiosoitteesi</h2>
          <p className="custom-signup-intro">Lähetimme sinulle vahvistuskoodin. Syötä se jatkaaksesi.</p>
          <form onSubmit={submitCode}>
            <label className="custom-signup-code-label">
              Vahvistuskoodi
              <div className="custom-signup-code" onPaste={handleCodePaste}>
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      codeInputs.current[index] = element
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Vahvistuskoodin numero ${index + 1}`}
                    maxLength={1}
                    required
                    value={code[index]}
                    onChange={(event) => updateCodeDigit(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Backspace' && !code[index] && index > 0) codeInputs.current[index - 1]?.focus()
                      if (event.key === 'ArrowLeft' && index > 0) codeInputs.current[index - 1]?.focus()
                      if (event.key === 'ArrowRight' && index < 5) codeInputs.current[index + 1]?.focus()
                    }}
                  />
                ))}
              </div>
            </label>
            <button
              className="custom-signup-submit"
              type="submit"
              disabled={!isReady || busy || code.some((digit) => !digit)}
            >
              {busy ? 'Vahvistetaan…' : 'Vahvista ja kirjaudu'}
            </button>
            <button
              className="custom-signup-resend"
              type="button"
              onClick={resendCode}
              disabled={!isReady || busy || resendAvailableAt > now}
            >
              {resendAvailableAt > now
                ? `Voit pyytää uuden koodin ${Math.ceil((resendAvailableAt - now) / 1000)} sekunnin kuluttua`
                : 'Lähetä uusi koodi'}
            </button>
            <small className="custom-signup-hint">
              Uusi koodi korvaa aiemman. Käytä aina viimeisintä sähköpostiin saapunutta koodia.
            </small>
          </form>
        </>
      )}
      {(message || errors?.global || protectCheckMissing) && (
        <p className="custom-signup-message" role="status">
          {message ||
            (errors?.global && clerkErrorText(errors.global, { fallback: errorFallback, passwordMinLength })) ||
            'Clerkin turvallisuustarkistus ei käynnistynyt. Päivitä sivu ja yritä uudelleen. Jos ongelma jatkuu, tarkista Clerk-sovelluksen suojausasetukset.'}
        </p>
      )}
    </div>
  )
}
