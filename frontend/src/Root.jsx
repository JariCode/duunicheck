import { ClerkProvider, ClerkLoading, Show } from '@clerk/react'
import { fiFI } from '@clerk/localizations'
import App from './App.jsx'
import AuthLanding from './components/AuthLanding/AuthLanding.jsx'
import LegalModalHost from './components/Legal/LegalModalHost.jsx'
import { clerkAppearance } from './clerkAppearance'
import { finnishUnstableErrors } from './clerk/finnishClerkErrors.js'
import { withBasePath } from './utils/basePath.js'
import './components/AuthLanding/clerk-theme.css'
import './components/AuthLanding/clerk-overrides.css'
import './styles/user-themes.css'
import './components/AuthLanding/clerk-profile-themes.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const clerkLocalization = {
  ...fiFI,
  // The sign-in heading already says "Kirjaudu sisään", so the default subtitle below it is redundant.
  signIn: {
    ...fiFI.signIn,
    start: { ...fiFI.signIn.start, subtitle: '' },
  },
  // Shared with the app's own sign-up form, which shows Clerk API errors itself.
  unstable__errors: finnishUnstableErrors,
}

const authDialogPaths = [withBasePath('sign-in'), withBasePath('sign-up')]
// The path itself or a sub-path, so /sign-in/factor-two matches but /sign-inx does not.
const isAuthDialogPath = (pathname) =>
  authDialogPaths.some((base) => pathname === base || pathname.startsWith(`${base}/`))

// Clerk navigates through these functions. Between the sign-in and sign-up steps a page load
// would make Clerk request the email verification code again, so the first code stops working;
// there only the history is updated and popstate tells Clerk's path router and the app's own
// route listeners that the address changed. Everywhere else (for example signing out from the
// app) and for other origins (Google, Clerk's Account Portal) the page loads fully as before,
// so that e.g. the beforeunload warning about unsaved work still works when signing out.
function navigateWithoutReload(to, replace) {
  const url = new URL(to, window.location.href)
  if (url.origin !== window.location.origin || !isAuthDialogPath(window.location.pathname)) {
    window.location.assign(url.href)
    return
  }
  const path = `${url.pathname}${url.search}${url.hash}`
  if (replace) window.history.replaceState(window.history.state, '', path)
  else window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
const routerPush = (to) => navigateWithoutReload(to, false)
const routerReplace = (to) => navigateWithoutReload(to, true)

export default function Root() {
  if (!publishableKey || publishableKey.includes('replace_with')) {
    return (
      <main className="auth-loading">
        Lisää Clerk publishable key frontendin .env-tiedostoon kirjautumisen ottamiseksi käyttöön.
      </main>
    )
  }
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={clerkLocalization}
      appearance={clerkAppearance}
      routerPush={routerPush}
      routerReplace={routerReplace}
      signInUrl={withBasePath('sign-in')}
      signUpUrl={withBasePath('sign-up')}
      signInFallbackRedirectUrl={import.meta.env.BASE_URL}
      signUpFallbackRedirectUrl={import.meta.env.BASE_URL}
    >
      <LegalModalHost />
      <ClerkLoading>
        <div className="auth-loading">Ladataan DuuniCheckiä…</div>
      </ClerkLoading>
      <Show when="signed-out">
        <AuthLanding />
      </Show>
      <Show when="signed-in">
        <App />
      </Show>
    </ClerkProvider>
  )
}
