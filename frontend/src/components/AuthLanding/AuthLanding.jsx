import './AuthLanding.css'
import './auth-landing-bars.css'
import './clerk-theme.css'
import './clerk-overrides.css'
import './auth-controls.css'
import { useEffect, useState } from 'react'
import { HandleSSOCallback, SignIn } from '@clerk/react'
import CustomSignUp from './CustomSignUp.jsx'
import { withBasePath } from '../../utils/basePath.js'

const appBasePath = import.meta.env.BASE_URL
const signInPath = withBasePath('sign-in')
const signUpPath = withBasePath('sign-up')
const signUpContinuePath = withBasePath('sign-up/continue')
const signUpSsoCallbackPath = withBasePath('sign-up/sso-callback')

export default function AuthLanding() {
  const inviteTicket = new URLSearchParams(window.location.search).has('__clerk_ticket')
  const currentPath = window.location.pathname
  const pathMode = currentPath === signUpPath || currentPath.startsWith(`${signUpPath}/`) ? 'sign-up' : currentPath === signInPath || currentPath.startsWith(`${signInPath}/`) ? 'sign-in' : null
  const [showLogin, setShowLogin] = useState(inviteTicket || Boolean(pathMode))
  const [authMode, setAuthMode] = useState(inviteTicket ? 'sign-up' : pathMode || 'sign-in')
  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname
      const mode = path === signUpPath || path.startsWith(`${signUpPath}/`) ? 'sign-up' : path === signInPath || path.startsWith(`${signInPath}/`) ? 'sign-in' : null
      if (mode) {
        setShowLogin(true)
        setAuthMode(mode)
      } else if (!new URLSearchParams(window.location.search).has('__clerk_ticket')) {
        setShowLogin(false)
      }
    }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])
  useEffect(() => {
    if (!showLogin || inviteTicket) return undefined
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setShowLogin(false)
      window.history.pushState({}, '', appBasePath)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [showLogin, inviteTicket])
  const openLogin = (mode = 'sign-in') => {
    setAuthMode(mode)
    setShowLogin(true)
    window.history.pushState({}, '', mode === 'sign-up' ? signUpPath : signInPath)
  }
  const switchMode = (mode) => {
    setAuthMode(mode)
    const nextUrl = new URL(mode === 'sign-up' ? signUpPath : signInPath, window.location.origin)
    if (inviteTicket) nextUrl.searchParams.set('__clerk_ticket', new URLSearchParams(window.location.search).get('__clerk_ticket'))
    window.history.pushState({}, '', nextUrl)
  }
  return <main className="auth-landing">
    <header className="auth-header"><a className="auth-brand" href="#top"><span>D</span> DuuniCheck<span className="auth-dot">.</span></a></header>
    <section className="auth-hero" id="top"><div className="auth-copy"><span className="auth-kicker">TYÖNHAKU, SELKEÄSTI HALLUSSA</span><h1>Pidä työnhaku<br/><em>omissa käsissäsi.</em></h1><p>Seuraa hakemustesi vaiheita ja muokkaa hakemustekstiä työpaikan mukaan.</p><button className="auth-cta" onClick={() => openLogin()}>Avaa DuuniCheck <span>↗</span></button><small>Kirjautuminen ja uuden tilin luonti avautuvat turvallisesti Clerkissä.</small></div><div className="auth-art" aria-hidden="true"><div className="auth-card auth-card-main"><span>TYÖNHAUN TILANNE</span><b>Näe, miten hakusi<br/>etenevät.</b><div className="auth-bars"><i/><i/><i/><i/><i/><i/><i/></div><div className="auth-card-footer"><span>Hakemukset</span><strong>14</strong></div></div><div className="auth-orbit auth-orbit-one"/><div className="auth-orbit auth-orbit-two"/><span className="auth-spark">✳</span></div></section>
    <footer className="auth-footer"><span>DUUNICHECK</span><span>Suunniteltu työnhaun arkeen.</span><span>Yksityiset tietosi kuuluvat sinulle.</span><nav aria-label="Lakitiedot"><a href={withBasePath('kayttoehdot')}>Käyttöehdot</a><a href={withBasePath('tietosuojaseloste')}>Tietosuojaseloste</a></nav></footer>
    {showLogin && <div className="auth-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !inviteTicket) { setShowLogin(false); window.history.pushState({}, '', appBasePath) } }}><section className="auth-dialog" role="dialog" aria-modal="true" aria-label={inviteTicket ? 'Kutsu DuuniCheckiin' : 'DuuniCheckin kirjautuminen ja tilin luonti'}><button className="auth-close" aria-label="Sulje kirjautuminen" disabled={inviteTicket} onClick={() => { setShowLogin(false); window.history.pushState({}, '', appBasePath) }}>×</button><span className="auth-kicker">{inviteTicket ? 'KUTSU DUUNICHECKIIN' : 'OMA TILI'}</span>{!inviteTicket && <div className="auth-mode-switch" role="tablist" aria-label="Valitse toiminto"><button type="button" role="tab" aria-selected={authMode === 'sign-in'} className={authMode === 'sign-in' ? 'active' : ''} onClick={() => switchMode('sign-in')}>Kirjaudu</button><button type="button" role="tab" aria-selected={authMode === 'sign-up'} className={authMode === 'sign-up' ? 'active' : ''} onClick={() => switchMode('sign-up')}>Luo tili</button></div>}{currentPath.startsWith(signUpSsoCallbackPath) ? <HandleSSOCallback navigateToApp={({ decorateUrl }) => window.location.assign(decorateUrl(appBasePath))} navigateToSignIn={() => window.location.assign(signInPath)} navigateToSignUp={() => window.location.assign(signUpContinuePath)} /> : authMode === 'sign-in' ? <SignIn routing="path" path={signInPath} /> : <CustomSignUp inviteTicket={inviteTicket ? new URLSearchParams(window.location.search).get('__clerk_ticket') : ''} continueSso={currentPath === signUpContinuePath} />}</section></div>}
  </main>
}
