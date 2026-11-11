import './AuthLanding.css'
import './auth-landing-bars.css'
import './clerk-theme.css'
import './clerk-overrides.css'
import './auth-controls.css'
import { useEffect, useState } from 'react'
import { HandleSSOCallback, SignIn } from '@clerk/react'
import CustomSignUp from './CustomSignUp.jsx'
import { withBasePath } from '../../utils/basePath.js'
import { useDialog } from '../../utils/useDialog.js'

const appBasePath = import.meta.env.BASE_URL
const signInPath = withBasePath('sign-in')
const signInSsoCallbackPath = withBasePath('sign-in/sso-callback')
const signUpPath = withBasePath('sign-up')
const signUpContinuePath = withBasePath('sign-up/continue')
const signUpSsoCallbackPath = withBasePath('sign-up/sso-callback')

const hasInviteTicket = () => new URLSearchParams(window.location.search).has('__clerk_ticket')
const isUnder = (path, base) => path === base || path.startsWith(`${base}/`)

// In Invite-only mode Clerk rejects a Google account that has no user and no invitation with
// sign_up_mode_restricted. Clerk's own callback would reload the sign-in page and lose the error,
// so the sign-in form is opened without a reload and Clerk shows the error there itself.
const isUninvitedGoogleReturn = () => {
  const error = window.Clerk?.client?.signIn?.firstFactorVerification?.error
  return isUnder(window.location.pathname, signInSsoCallbackPath) && error?.code === 'sign_up_mode_restricted'
}

// The dialog opens on the sign-in and sign-up addresses and for an invitation link.
// Whether sign-up is offered at all is decided by Clerk's sign-up mode: in Restricted mode
// Clerk hides its sign-up link and rejects sign-ups without an invitation on its server.
const readAuthRoute = () => {
  if (isUninvitedGoogleReturn()) window.history.replaceState({}, '', signInPath)
  const path = window.location.pathname
  return { open: hasInviteTicket() || isUnder(path, signUpPath) || isUnder(path, signInPath), path }
}

export default function AuthLanding() {
  const inviteTicket = hasInviteTicket()
  const [route, setRoute] = useState(readAuthRoute)
  const currentPath = route.path
  const showLogin = route.open
  const showSignUp = inviteTicket || isUnder(currentPath, signUpPath)
  useEffect(() => {
    const syncRoute = () => setRoute(readAuthRoute())
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])
  const openLogin = () => {
    window.history.pushState({}, '', signInPath)
    setRoute({ open: true, path: signInPath })
  }
  const closeLogin = () => {
    window.history.pushState({}, '', appBasePath)
    setRoute({ open: false, path: appBasePath })
  }
  // An invitation link keeps the dialog open, so Escape does not close it.
  const dialogRef = useDialog({ open: showLogin, onClose: closeLogin, canClose: !inviteTicket })
  return (
    <main className="auth-landing">
      <header className="auth-header">
        <a className="auth-brand" href="#top">
          <span>D</span> DuuniCheck<span className="auth-dot">.</span>
        </a>
      </header>
      <section className="auth-hero" id="top">
        <div className="auth-copy">
          <span className="auth-kicker">TYÖNHAKU, SELKEÄSTI HALLUSSA</span>
          <h1>
            Pidä työnhaku
            <br />
            <em>omissa käsissäsi.</em>
          </h1>
          <p>Seuraa hakemustesi vaiheita ja muokkaa hakemustekstiä työpaikan mukaan.</p>
          <button className="auth-cta" onClick={() => openLogin()}>
            Avaa DuuniCheck <span>↗</span>
          </button>
          <small>Kirjautuminen avautuu turvallisesti Clerkissä.</small>
        </div>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-card auth-card-main">
            <span>TYÖNHAUN TILANNE</span>
            <b>
              Näe, miten hakusi
              <br />
              etenevät.
            </b>
            <div className="auth-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="auth-card-footer">
              <span>Hakemukset</span>
              <strong>14</strong>
            </div>
          </div>
          <div className="auth-orbit auth-orbit-one" />
          <div className="auth-orbit auth-orbit-two" />
          <span className="auth-spark">✳</span>
        </div>
      </section>
      <footer className="auth-footer">
        <span>DUUNICHECK</span>
        <span>Suunniteltu työnhaun arkeen.</span>
        <span>Yksityiset tietosi kuuluvat sinulle.</span>
        <nav aria-label="Lakitiedot">
          <a href={withBasePath('kayttoehdot')}>Käyttöehdot</a>
          <a href={withBasePath('tietosuojaseloste')}>Tietosuojaseloste</a>
        </nav>
      </footer>
      {showLogin && (
        <div
          className="auth-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !inviteTicket) closeLogin()
          }}
        >
          <section
            ref={dialogRef}
            tabIndex="-1"
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={inviteTicket ? 'Kutsu DuuniCheckiin' : 'DuuniCheckin kirjautuminen'}
          >
            <button
              className="auth-close"
              aria-label="Sulje kirjautuminen"
              disabled={inviteTicket}
              onClick={closeLogin}
            >
              ×
            </button>
            <span className="auth-kicker">{inviteTicket ? 'KUTSU DUUNICHECKIIN' : 'OMA TILI'}</span>
            {currentPath.startsWith(signUpSsoCallbackPath) ? (
              <HandleSSOCallback
                navigateToApp={({ decorateUrl }) => window.location.assign(decorateUrl(appBasePath))}
                navigateToSignIn={() => window.location.assign(signInPath)}
                navigateToSignUp={() => window.location.assign(signUpContinuePath)}
              />
            ) : showSignUp ? (
              <CustomSignUp
                inviteTicket={inviteTicket ? new URLSearchParams(window.location.search).get('__clerk_ticket') : ''}
                continueSso={currentPath === signUpContinuePath}
              />
            ) : (
              <SignIn routing="path" path={signInPath} />
            )}
          </section>
        </div>
      )}
    </main>
  )
}
