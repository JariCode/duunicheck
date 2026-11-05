import './AuthLanding.css'
import './auth-landing-bars.css'
import './clerk-theme.css'
import './clerk-overrides.css'
import './auth-controls.css'
import { useEffect, useState } from 'react'
import { SignIn, SignUp } from '@clerk/clerk-react'

export default function AuthLanding() {
  const inviteTicket = new URLSearchParams(window.location.search).has('__clerk_ticket')
  const currentPath = window.location.pathname
  const pathMode = currentPath === '/sign-up' || currentPath.startsWith('/sign-up/') ? 'sign-up' : currentPath === '/sign-in' || currentPath.startsWith('/sign-in/') ? 'sign-in' : null
  const [showLogin, setShowLogin] = useState(inviteTicket || Boolean(pathMode))
  const [authMode, setAuthMode] = useState(inviteTicket ? 'sign-up' : pathMode || 'sign-in')
  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname
      const mode = path === '/sign-up' || path.startsWith('/sign-up/') ? 'sign-up' : path === '/sign-in' || path.startsWith('/sign-in/') ? 'sign-in' : null
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
  const openLogin = (mode = 'sign-in') => {
    setAuthMode(mode)
    setShowLogin(true)
    window.history.pushState({}, '', mode === 'sign-up' ? '/sign-up' : '/sign-in')
  }
  const switchMode = (mode) => {
    setAuthMode(mode)
    const nextUrl = new URL(mode === 'sign-up' ? '/sign-up' : '/sign-in', window.location.origin)
    if (inviteTicket) nextUrl.searchParams.set('__clerk_ticket', new URLSearchParams(window.location.search).get('__clerk_ticket'))
    window.history.pushState({}, '', nextUrl)
  }
  return <main className="auth-landing">
    <header className="auth-header"><a className="auth-brand" href="#top"><span>D</span> DuuniCheck<span className="auth-dot">.</span></a><button className="auth-login-link" onClick={() => openLogin()}>Kirjaudu sisään</button></header>
    <section className="auth-hero" id="top"><div className="auth-copy"><span className="auth-kicker">TYÖNHAKU, SELKEÄSTI HALLUSSA</span><h1>Pidä työnhaku<br/><em>omissa käsissäsi.</em></h1><p>Seuraa hakemustesi vaiheita ja muokkaa hakemustekstiä työpaikan mukaan.</p><button className="auth-cta" onClick={() => openLogin()}>Avaa DuuniCheck <span>↗</span></button><small>Kirjautuminen ja uuden tilin luonti avautuvat turvallisesti Clerkissä.</small></div><div className="auth-art" aria-hidden="true"><div className="auth-card auth-card-main"><span>TYÖNHAUN TILANNE</span><b>Näe, miten hakusi<br/>etenevät.</b><div className="auth-bars"><i/><i/><i/><i/><i/><i/><i/></div><div className="auth-card-footer"><span>Hakemukset</span><strong>14</strong></div></div><div className="auth-orbit auth-orbit-one"/><div className="auth-orbit auth-orbit-two"/><span className="auth-spark">✳</span></div></section>
    <footer className="auth-footer"><span>DUUNICHECK</span><span>Suunniteltu työnhaun arkeen.</span><span>Yksityiset tietosi kuuluvat sinulle.</span></footer>
    {showLogin && <div className="auth-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !inviteTicket) { setShowLogin(false); window.history.pushState({}, '', '/') } }}><section className="auth-dialog" role="dialog" aria-modal="true" aria-label={inviteTicket ? 'Kutsu DuuniCheckiin' : 'DuuniCheckin kirjautuminen ja tilin luonti'}><button className="auth-close" aria-label="Sulje kirjautuminen" disabled={inviteTicket} onClick={() => { setShowLogin(false); window.history.pushState({}, '', '/') }}>×</button><span className="auth-kicker">{inviteTicket ? 'KUTSU DUUNICHECKIIN' : 'OMA TILI'}</span>{!inviteTicket && <div className="auth-mode-switch" role="tablist" aria-label="Valitse toiminto"><button type="button" role="tab" aria-selected={authMode === 'sign-in'} className={authMode === 'sign-in' ? 'active' : ''} onClick={() => switchMode('sign-in')}>Kirjaudu</button><button type="button" role="tab" aria-selected={authMode === 'sign-up'} className={authMode === 'sign-up' ? 'active' : ''} onClick={() => switchMode('sign-up')}>Luo tili</button></div>}{authMode === 'sign-in' ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" /> : <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />}</section></div>}
  </main>
}
