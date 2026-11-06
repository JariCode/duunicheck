import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import LegalModal from './LegalModal.jsx'
import { legalHref, legalPageFromHref, legalPageFromPath } from '../../utils/legalPath.js'

export default function LegalModalHost() {
  const { isLoaded, isSignedIn } = useAuth()
  const [page, setPage] = useState(() => legalPageFromPath(window.location.pathname))
  const [appTheme, setAppTheme] = useState('default')
  const openedByRef = useRef(null)
  const directPathRef = useRef(Boolean(legalPageFromPath(window.location.pathname)))

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined
    const updateTheme = () => {
      const nextTheme = document.documentElement.dataset.duunicheckTheme
      setAppTheme(['default', 'dark', 'light'].includes(nextTheme) ? nextTheme : 'default')
    }
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-duunicheck-theme'] })
    const initialSync = requestAnimationFrame(updateTheme)
    return () => {
      cancelAnimationFrame(initialSync)
      observer.disconnect()
    }
  }, [isLoaded, isSignedIn])

  const close = useCallback(() => {
    setPage(null)
    if (directPathRef.current) {
      window.history.replaceState(window.history.state, '', legalHref(''))
      directPathRef.current = false
    }
    const opener = openedByRef.current
    openedByRef.current = null
    window.requestAnimationFrame(() => opener?.isConnected && opener.focus())
  }, [])

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]')
      if (!anchor) return
      const nextPage = legalPageFromHref(anchor.href)
      if (!nextPage) return
      event.preventDefault()
      event.stopPropagation()
      openedByRef.current = anchor
      directPathRef.current = false
      setPage(nextPage)
    }
    const onOpenLegal = (event) => {
      const nextPage = event.detail
      if (nextPage !== 'kayttoehdot' && nextPage !== 'tietosuojaseloste') return
      openedByRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      directPathRef.current = false
      setPage(nextPage)
    }
    const onPopState = () => {
      const nextPage = legalPageFromPath(window.location.pathname)
      directPathRef.current = Boolean(nextPage)
      setPage(nextPage)
    }
    document.addEventListener('click', onDocumentClick, true)
    window.addEventListener('duunicheck:open-legal', onOpenLegal)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onDocumentClick, true)
      window.removeEventListener('duunicheck:open-legal', onOpenLegal)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  return page ? <LegalModal page={page} theme={isSignedIn ? appTheme : 'default'} onClose={close} /> : null
}
