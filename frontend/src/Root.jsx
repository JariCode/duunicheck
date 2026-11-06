import { ClerkProvider, ClerkLoading, Show } from '@clerk/react'
import { fiFI } from '@clerk/localizations'
import App from './App.jsx'
import AuthLanding from './components/AuthLanding/AuthLanding.jsx'
import LegalModalHost from './components/Legal/LegalModalHost.jsx'
import { clerkAppearance } from './clerkAppearance'
import './components/AuthLanding/clerk-theme.css'
import './components/AuthLanding/clerk-overrides.css'
import './styles/user-themes.css'
import './components/AuthLanding/clerk-profile-themes.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// The sign-in heading already says "Kirjaudu sisään", so the default subtitle below it is redundant.
const clerkLocalization = { ...fiFI, signIn: { ...fiFI.signIn, start: { ...fiFI.signIn.start, subtitle: '' } } }

export default function Root() {
  if (!publishableKey || publishableKey.includes('replace_with')) {
    return <main className="auth-loading">Lisää Clerk publishable key frontendin .env-tiedostoon kirjautumisen ottamiseksi käyttöön.</main>
  }
  return <ClerkProvider publishableKey={publishableKey} localization={clerkLocalization} appearance={clerkAppearance} signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
    <LegalModalHost />
    <ClerkLoading><div className="auth-loading">Ladataan DuuniCheckiä…</div></ClerkLoading>
    <Show when="signed-out"><AuthLanding /></Show>
    <Show when="signed-in"><App /></Show>
  </ClerkProvider>
}
