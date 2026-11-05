import './AssistantPage.css'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiRequest } from '../../api'

function isApplicationInfoQuestion(value) {
  const asksForFacts = /(tila|tilanne|vaihe|status|milloin|päivä|lähetetty|lähetyspäivä|vastaus|vastannut|haastattel|tapahtum|historia|muistut|seuraava|yritys|tehtävä|muistiinpano)/i.test(value)
  const asksAboutTheSelectedApplication = /(mitä|kerro|näytä|listaa).*(hakemuks|hausta|valitusta)/i.test(value)
  const asksForApplicationDetails = /(tiedot|tietoja)/i.test(value) && /(hakemuks|hausta|valitusta|tästä|tästä hausta)/i.test(value)
  return asksForFacts || asksAboutTheSelectedApplication || asksForApplicationDetails
}

export default function AssistantPage({ jobs, cvs, templates, initialJobId }) {
  const { getToken } = useAuth()
  const [jobId, setJobId] = useState(initialJobId || '')
  const [context, setContext] = useState({ posting: false, cv: false, template: false, application: false, allowSuggestions: false })
  const [draft, setDraft] = useState('')
  const [postingText, setPostingText] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [loadedForJobId, setLoadedForJobId] = useState('')
  const [error, setError] = useState('')
  const [applicationPickerOpen, setApplicationPickerOpen] = useState(false)
  const applicationPickerRef = useRef(null)
  const applicationPickerTriggerRef = useRef(null)
  const historyLoading = Boolean(jobId && loadedForJobId !== jobId)
  const visibleMessages = Boolean(jobId) && loadedForJobId === jobId ? messages : []
  const job = jobs.find((item) => String(item.id) === String(jobId))
  const cv = cvs.find((item) => item.id === job?.cvId)
  const template = templates.find((item) => item.id === job?.templateId)
  const toggle = (key) => setContext((current) => ({ ...current, [key]: !current[key] }))

  useEffect(() => {
    const closePicker = (event) => {
      if (!applicationPickerRef.current?.contains(event.target)) setApplicationPickerOpen(false)
    }
    document.addEventListener('pointerdown', closePicker)
    return () => document.removeEventListener('pointerdown', closePicker)
  }, [])

  function chooseJob(value) {
    setJobId(String(value))
    setLoadedForJobId('')
    setError('')
    setDraft('')
    setContext({ posting: false, cv: false, template: false, application: false, allowSuggestions: false })
    setApplicationPickerOpen(false)
  }

  useEffect(() => {
    if (!jobId) return undefined
    let active = true
    apiRequest(getToken, `/conversations/${jobId}`).then(({ messages: history }) => {
      if (active) {
        setMessages(history)
        setLoadedForJobId(jobId)
      }
    }).catch((loadError) => {
      if (active) {
        setMessages([])
        setError(loadError.message)
        setLoadedForJobId(jobId)
      }
    })
    return () => { active = false }
  }, [getToken, jobId])

  async function sendMessage() {
    const selectedMessage = draft.trim()
    const localQuestion = isApplicationInfoQuestion(selectedMessage)
    if (!job || (!localQuestion && !context.allowSuggestions) || !selectedMessage || sending || historyLoading) return
    setSending(true)
    setError('')
    try {
      const result = await apiRequest(getToken, localQuestion ? `/conversations/${job.id}/answer` : '/assistant/suggest', { method: 'POST', body: localQuestion ? { message: selectedMessage } : {
        message: selectedMessage,
        context: {
          applicationId: String(job.id),
          includePosting: context.posting,
          postingText: context.posting ? postingText : '',
          includeCv: context.cv,
          includeTemplate: context.template,
          includeApplication: context.application,
          allowSuggestions: true,
        },
      } })
      const answer = localQuestion ? result.answer : result.suggestion
      setMessages((all) => [...all,
        { id: `user-${Date.now()}`, role: 'user', content: selectedMessage },
        { id: `assistant-${Date.now()}`, role: 'assistant', content: answer },
      ])
      setDraft('')
    } catch (sendError) { setError(sendError.message) }
    finally { setSending(false) }
  }
  return <div className="assistant-page">
    <div className="assistant-layout"><section className="paper assistant-chat"><div className="chat-header"><div><span className="chat-avatar">AI</span><span><b>DuuniCheck-työpari</b><small>Yksityinen, hakemuskohtainen tallennettu keskustelu</small></span></div><span className="connection-state">Hakemustiedot haetaan omasta tietokannasta. AI auttaa ehdotuksissa.</span></div>
      <div className="chat-messages"><article className="assistant-message"><b>Työpari</b><p>Voin ehdottaa hakemukseen kohdennettuja muutoksia valitsemiesi tietojen pohjalta. Ehdotus ei tallennu hakemukseen ennen kuin hyväksyt sen itse.</p><small>Työpaikkailmoituksen lukemiseen liitä sen teksti sivupaneelin kenttään.</small></article>{historyLoading && <p className="permission-empty">Ladataan keskusteluhistoriaa…</p>}{visibleMessages.map((message, index) => <article className={message.role === 'user' ? 'user-message' : 'assistant-message'} key={message.id || index}><b>{message.role === 'user' ? 'Sinun pyyntösi' : 'Työpari · ehdotus'}</b><p>{message.content}</p>{message.role === 'assistant' && <small>Voit kopioida ehdotuksen ja hyväksyä muokkauksen itse hakemuksessa.</small>}</article>)}</div>
      {error && <p className="assistant-error" role="alert">{error}</p>}<label className="chat-composer">Viesti työparille<textarea rows="3" maxLength="4000" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage() } }} placeholder="Kirjoita viesti työparille…" /></label><button className="add-button chat-send" onClick={sendMessage} disabled={!job || (!context.allowSuggestions && !isApplicationInfoQuestion(draft)) || !draft.trim() || sending || historyLoading}>{sending ? 'Lähetetään…' : 'Lähetä viesti'}</button>
    </section>
    <aside className="paper assistant-permissions"><h3>Valitse keskustelun konteksti</h3><div className="application-picker" ref={applicationPickerRef} onKeyDown={(event) => { if (event.key === 'Escape') { setApplicationPickerOpen(false); applicationPickerTriggerRef.current?.focus() } }}><span className="application-picker-label">Hakemus</span><button ref={applicationPickerTriggerRef} type="button" className="application-picker-trigger" aria-haspopup="listbox" aria-expanded={applicationPickerOpen} onClick={() => setApplicationPickerOpen((open) => !open)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setApplicationPickerOpen(true) } }}>{job ? `${job.company} · ${job.role}` : 'Valitse hakemus'}<span aria-hidden="true">⌄</span></button>{applicationPickerOpen && <div className="application-picker-options" role="listbox" aria-label="Valitse hakemus">{jobs.map((item) => <button type="button" role="option" aria-selected={String(item.id) === String(jobId)} className={String(item.id) === String(jobId) ? 'is-selected' : ''} key={item.id} onClick={() => chooseJob(item.id)}>{item.company} · {item.role}</button>)}</div>}</div>
      {job && <div className="permission-list"><small>AI käyttää tietoa vain, kun kytket sen erikseen:</small><label><input type="checkbox" checked={context.posting} onChange={() => toggle('posting')} /> Työpaikkailmoitus {job.link ? '· luetaan tallennetusta HTTPS-linkistä' : '· linkkiä ei ole tallennettu'}</label>{context.posting && <textarea className="posting-context" rows="5" maxLength="16000" value={postingText} onChange={(event) => setPostingText(event.target.value)} placeholder="Voit liittää ilmoituksen tekstin tähän, jos linkin automaattinen luku ei onnistu." />}<label><input type="checkbox" checked={context.cv} onChange={() => toggle('cv')} /> Valittu CV {cv ? '· ' + cv.name : '· valitse CV hakemukselle'}</label><label><input type="checkbox" checked={context.template} onChange={() => toggle('template')} /> Hakemuspohja {template ? '· ' + template.name : '· ei valittua pohjaa'}</label><label><input type="checkbox" checked={context.application} onChange={() => toggle('application')} /> Tämän hakemuksen muistiinpanot</label><hr/><label className="approval-choice"><input type="checkbox" checked={context.allowSuggestions} onChange={() => toggle('allowSuggestions')} /> AI saa ehdottaa muutoksia tähän hakemukseen. Mitään ei tallenneta ennen hyväksyntääni.</label></div>}
      {!job && <p className="permission-empty">Valitse hakemus, niin voit kysyä sen tiedoista tai pyytää AI:lta ehdotuksia.</p>}<p className="privacy-note">Hakemuksen tiedot luetaan DuuniCheckin tietokannasta, eikä niitä lähetetä OpenAI:lle tietokantakysymyksissä. AI-ehdotuksiin lähetetään vain viesti ja erikseen valitsemasi lisätiedot. Keskustelut tallennetaan hakemuksen yhteyteen.</p>
    </aside></div>
  </div>
}
