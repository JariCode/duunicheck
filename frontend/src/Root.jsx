import { ClerkProvider, ClerkLoading, SignedIn, SignedOut } from '@clerk/clerk-react'
import { fiFI } from '@clerk/localizations'
import App from './App.jsx'
import AuthLanding from './components/AuthLanding/AuthLanding.jsx'
import { clerkAppearance } from './clerkAppearance'
import './components/AuthLanding/clerk-theme.css'
import './components/AuthLanding/clerk-overrides.css'
import './styles/user-themes.css'
import './components/AuthLanding/clerk-profile-themes.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

export default function Root() {
  if (!publishableKey || publishableKey.includes('replace_with')) {
    return <main className="auth-loading">Lisää Clerk publishable key frontendin .env-tiedostoon kirjautumisen ottamiseksi käyttöön.</main>
  }
  return <ClerkProvider publishableKey={publishableKey} localization={fiFI} appearance={clerkAppearance} signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
    <ClerkLoading><div className="auth-loading">Ladataan DuuniCheckiä…</div></ClerkLoading>
    <SignedOut><AuthLanding /></SignedOut>
    <SignedIn><App /></SignedIn>
  </ClerkProvider>
}
