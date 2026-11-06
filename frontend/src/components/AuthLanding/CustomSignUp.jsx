import { useEffect, useRef, useState } from 'react'
import { useSignUp } from '@clerk/react'
import './CustomSignUp.css'

function errorText(error) {
  const first = error?.errors?.[0] || error
  const code = first?.code
  if (code === 'form_identifier_exists' || code === 'duplicate_email') {
    return 'Tällä sähköpostiosoitteella on jo tili. Kirjaudu sisään.'
  }
  return first?.longMessage || first?.message || 'Tilin luonti ei onnistunut. Tarkista tiedot ja yritä uudelleen.'
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
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
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
    void signUp.finalize({
      navigate: ({ decorateUrl }) => window.location.assign(decorateUrl('/')),
    }).then(({ error }) => {
      if (error) setMessage(errorText(error))
    }).catch((error) => setMessage(errorText(error)))
  }, [continueSso, isReady, signUp, signUp?.status])

  const currentMissingFields = continueSso && signUp?.status === 'missing_requirements'
    ? signUp.missingFields
    : missingFields
  const protectCheckMissing = continueSso && signUp?.status === 'missing_requirements' && signUp.missingFields.includes('protect_check')
  const currentView = continueSso && errors?.global
    ? 'form'
    : continueSso && isReady && signUp?.status === 'missing_requirements'
    ? signUp.missingFields.includes('protect_check') ? 'form' : signUp.unverifiedFields.includes('email_address') ? 'code' : 'details'
    : continueSso && (!isReady || !signUp || signUp.status !== 'missing_requirements')
      ? 'loading'
      : view

  async function finishSignUp() {
    if (signUp.status !== 'complete') return
    const { error } = await signUp.finalize({
      navigate: ({ decorateUrl }) => window.location.assign(decorateUrl('/')),
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
      setMessage('Clerkin turvallisuustarkistus ei käynnistynyt. Päivitä sivu ja yritä uudelleen. Jos ongelma jatkuu, tarkista Clerk-sovelluksen suojausasetukset.')
      return
    }
    if (signUp.unverifiedFields.includes('email_address')) {
      setView('code')
      if (sendCode && !codeSent) {
        const { error } = await signUp.verifications.sendEmailCode()
        if (error) throw error
        setCodeSent(true)
        setResendAvailableAt(Date.now() + 30_000)
        setNow(Date.now())
      }
      return
    }

    if (missing.length) {
      setView('details')
      return
    }
    setMessage('Clerk ei vielä saanut tilin luontia valmiiksi. Tarkista Clerk-tilin rekisteröintiasetukset ja yritä uudelleen.')
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
      const { error } = inviteTicket
        ? await signUp.ticket({ ticket: inviteTicket, legalAccepted: true })
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
      if (missingFields.includes('first_name')) updates.firstName = firstName.trim()
      if (missingFields.includes('last_name')) updates.lastName = lastName.trim()
      if (missingFields.includes('legal_accepted')) updates.legalAccepted = accepted
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
      digits.split('').forEach((digit, offset) => { next[index + offset] = digit })
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
        redirectUrl: '/',
        redirectCallbackUrl: '/sign-up/sso-callback',
        legalAccepted: true,
      })
      if (error) throw error
    } catch (error) {
      setMessage(errorText(error))
      setBusy(false)
    }
  }

  return <div className="custom-signup">
    {currentView === 'loading' ? <p className="custom-signup-intro" role="status">Viimeistellään Google-kirjautumista…</p> : currentView === 'form' ? <>
      <h2>{inviteTicket ? 'Luo kutsutili' : 'Luo DuuniCheck-tili'}</h2>
      <p className="custom-signup-intro">{inviteTicket ? 'Viimeistele kutsun hyväksyminen.' : 'Luo tili sähköpostiosoitteella tai Googlella.'}</p>
      {!inviteTicket && <>
        <button type="button" className="custom-signup-google" onClick={continueWithGoogle} disabled={!isReady || busy}>Jatka Googlella</button>
        <div className="custom-signup-divider"><span>tai sähköpostilla</span></div>
      </>}
      <form onSubmit={submitSignUp}>
        {!inviteTicket && <label>Sähköpostiosoite<input type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
        {!inviteTicket && <label>Salasana<input type="password" autoComplete="new-password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
        <label className="custom-signup-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Olen lukenut ja hyväksyn <a href="/kayttoehdot">käyttöehdot</a> ja <a href="/tietosuojaseloste">tietosuojaselosteen</a>.</span></label>
        <button className="custom-signup-submit" type="submit" disabled={!isReady || busy}>{busy ? 'Luodaan tiliä…' : inviteTicket ? 'Hyväksy kutsu' : 'Luo tili'}</button>
      </form>
    </> : currentView === 'details' ? <>
      <h2>Täydennä tilin tiedot</h2>
      <p className="custom-signup-intro">Clerk tarvitsee nämä tiedot tilin luomista varten.</p>
      <form onSubmit={submitDetails}>
        {currentMissingFields.includes('first_name') && <label>Etunimi<input autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>}
        {currentMissingFields.includes('last_name') && <label>Sukunimi<input autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>}
        {currentMissingFields.includes('legal_accepted') && <label className="custom-signup-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Olen lukenut ja hyväksyn <a href="/kayttoehdot">käyttöehdot</a> ja <a href="/tietosuojaseloste">tietosuojaselosteen</a>.</span></label>}
        <button className="custom-signup-submit" type="submit" disabled={!isReady || busy || (currentMissingFields.includes('legal_accepted') && !accepted)}>{busy ? 'Tallennetaan…' : 'Jatka'}</button>
      </form>
    </> : <>
      <h2>Vahvista sähköpostiosoitteesi</h2>
      <p className="custom-signup-intro">Lähetimme sinulle vahvistuskoodin. Syötä se jatkaaksesi.</p>
      <form onSubmit={submitCode}>
        <label className="custom-signup-code-label">Vahvistuskoodi
          <div className="custom-signup-code" onPaste={handleCodePaste}>
            {Array.from({ length: 6 }, (_, index) => <input
              key={index}
              ref={(element) => { codeInputs.current[index] = element }}
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
            />)}
          </div>
        </label>
        <button className="custom-signup-submit" type="submit" disabled={!isReady || busy || code.some((digit) => !digit)}>{busy ? 'Vahvistetaan…' : 'Vahvista ja kirjaudu'}</button>
        <button className="custom-signup-resend" type="button" onClick={resendCode} disabled={!isReady || busy || resendAvailableAt > now}>{resendAvailableAt > now ? `Voit pyytää uuden koodin ${Math.ceil((resendAvailableAt - now) / 1000)} sekunnin kuluttua` : 'Lähetä uusi koodi'}</button>
      </form>
    </>}
    {(message || errors?.global?.message || protectCheckMissing) && <p className="custom-signup-message" role="status">{message || errors?.global?.message || 'Clerkin turvallisuustarkistus ei käynnistynyt. Päivitä sivu ja yritä uudelleen. Jos ongelma jatkuu, tarkista Clerk-sovelluksen suojausasetukset.'}</p>}
  </div>
}
