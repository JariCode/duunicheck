import './AssistantPage.css'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import { apiRequest } from '../../api'
import { safeHttpUrl, today } from '../../utils'

const localId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// Picks the first http(s) address from a pasted posting; trailing punctuation is not part of the link.
function extractPostingLink(value) {
  const match = value.match(/https?:\/\/[^\s<>"'`]+/i)
  const link = match ? safeHttpUrl(match[0].replace(/[.,;:!?)\]]+$/, '')) : ''
  return link.length <= 2048 ? link : ''
}

const sameLink = (left, right) => {
  const a = safeHttpUrl(String(left || '').trim())
  return Boolean(a) && a === safeHttpUrl(String(right || '').trim())
}

// Deadline arrives as YYYY-MM-DD and is written as pp.kk.vvvv.
function postingDraftNotes({ deadline, source }) {
  const [year, month, day] = (deadline || '').split('-')
  return [deadline && `Haku päättyy: ${day}.${month}.${year}`, source && `Lähde: ${source}`].filter(Boolean).join('\n')
}

// Local list covers links edited after parsing; the server result covers the parsed link.
function findDuplicate(message, jobs) {
  const local = message.fields.link.trim() ? jobs.find((job) => sameLink(job.link, message.fields.link)) : null
  if (local) return local
  return message.serverDuplicate && sameLink(message.serverDuplicate.link, message.fields.link) ? message.serverDuplicate : null
}

function PostingDraftMessage({ message, jobs, onChange, onAcknowledge, onSave }) {
  const { fields, saving, saved, error } = message
  const duplicate = findDuplicate(message, jobs)
  const acknowledged = Boolean(duplicate) && message.acknowledgedLink === fields.link
  const field = (name) => ({ value: fields[name], onChange: (event) => onChange({ ...fields, [name]: event.target.value }) })
  return <article className="assistant-message posting-draft-message">
    <b>Työpari · hakemuspohja</b>
    <p>{saved ? 'Tämä pohja on tallennettu hakemukseksi.' : 'Tarkista ja korjaa tiedot ennen tallennusta. Tyhjät kentät eivät löytyneet ilmoituksen tekstistä.'}</p>
    <form onSubmit={(event) => { event.preventDefault(); onSave() }}>
      <fieldset disabled={saving || saved}>
        <label>Yritys<input maxLength="160" required {...field('company')} /></label>
        <label>Tehtävä<input maxLength="160" required {...field('role')} /></label>
        <label>Paikkakunta<input maxLength="160" {...field('place')} /></label>
        <label>Linkki<input type="url" inputMode="url" maxLength="2048" placeholder="https://…" {...field('link')} /></label>
        <label>Muistiinpanot<textarea rows="2" maxLength="8000" {...field('notes')} /></label>
        {duplicate && !saved && <div className="posting-duplicate" role="alert"><span>Sinulla on jo hakemus tällä linkillä: <b>{duplicate.company} · {duplicate.role}</b>.</span><label><input type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledge(event.target.checked ? fields.link : null)} /> Tallenna silti uutena hakemuksena</label></div>}
        {error && <span className="assistant-error" role="alert">{error}</span>}
        {!saved && <button type="submit" className="add-button chat-send" disabled={saving || !fields.company.trim() || !fields.role.trim() || (duplicate && !acknowledged)}>{saving ? 'Tallennetaan…' : 'Tallenna hakemus'}</button>}
      </fieldset>
    </form>
    {!saved && <small>Hakemus tallennetaan vaiheeseen Kiinnostava.</small>}
  </article>
}

function isApplicationInfoQuestion(value) {
  const asksForFacts = /(tila|tilanne|vaihe|status|milloin|päivä|lähetetty|lähetyspäivä|vastaus|vastannut|haastattel|tapahtum|historia|muistut|seuraava|yritys|tehtävä|muistiinpano)/i.test(value)
  const asksAboutTheSelectedApplication = /(mitä|kerro|näytä|listaa).*(hakemuks|hausta|valitusta)/i.test(value)
  const asksForApplicationDetails = /(tiedot|tietoja)/i.test(value) && /(hakemuks|hausta|valitusta|tästä|tästä hausta)/i.test(value)
  return asksForFacts || asksAboutTheSelectedApplication || asksForApplicationDetails
}

export default function AssistantPage({ jobs, cvs, templates, initialJobId, onSelectJob, onApplicationCreated }) {
  const { getToken } = useAuth()
  const [jobId, setJobId] = useState(initialJobId || '')
  const [context, setContext] = useState({ posting: false, cv: false, template: false, application: false, allowSuggestions: false })
  const [draft, setDraft] = useState('')
  const [postingText, setPostingText] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [postingDraftMode, setPostingDraftMode] = useState(false)
  const [loadedForJobId, setLoadedForJobId] = useState('')
  const [error, setError] = useState('')
  const [applicationPickerOpen, setApplicationPickerOpen] = useState(false)
  const applicationPickerRef = useRef(null)
  const applicationPickerTriggerRef = useRef(null)
  const chatMessagesRef = useRef(null)
  const historyLoading = Boolean(jobId && loadedForJobId !== jobId)
  // Without a selected application only local posting-draft messages exist, so show them.
  const visibleMessages = !jobId ? messages : loadedForJobId === jobId ? messages : []
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
    onSelectJob?.(String(value))
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

  useEffect(() => {
    if (historyLoading || !chatMessagesRef.current) return undefined
    const chat = chatMessagesRef.current
    const scrollToLatest = () => { chat.scrollTop = chat.scrollHeight }
    scrollToLatest()
    const frame = window.requestAnimationFrame(scrollToLatest)
    return () => window.cancelAnimationFrame(frame)
  }, [historyLoading, jobId, messages])

  const updateMessage = (id, patch) => setMessages((all) => all.map((item) => item.id === id ? { ...item, ...patch } : item))

  // Posting drafts are local chat messages: parse-posting stores nothing and the conversation history is not touched.
  async function sendPostingDraft(postingTextValue) {
    const link = extractPostingLink(postingTextValue)
    setSending(true)
    setError('')
    try {
      const result = await apiRequest(getToken, '/assistant/parse-posting', { method: 'POST', body: { postingText: postingTextValue, link } })
      const { company, role, place, link: parsedLink } = result.draft
      setMessages((all) => [...all,
        { id: localId('user'), role: 'user', content: postingTextValue },
        {
          id: localId('posting-draft'),
          role: 'posting-draft',
          fields: { company, role, place, link: parsedLink, notes: postingDraftNotes(result.draft) },
          serverDuplicate: result.existingApplication ? { ...result.existingApplication, link: parsedLink } : null,
          acknowledgedLink: null,
          saving: false,
          saved: false,
          error: '',
        },
      ])
      setDraft('')
    } catch (sendError) { setError(sendError.message) }
    finally { setSending(false) }
  }

  async function savePostingDraft(message) {
    const company = message.fields.company.trim()
    const role = message.fields.role.trim()
    const link = message.fields.link.trim()
    if (!company || !role) return updateMessage(message.id, { error: 'Yritys ja tehtävä ovat pakollisia.' })
    if (link && !safeHttpUrl(link)) return updateMessage(message.id, { error: 'Tarkista linkki: sen pitää alkaa http:// tai https://.' })
    if (findDuplicate(message, jobs) && message.acknowledgedLink !== message.fields.link) return updateMessage(message.id, { error: 'Sinulla on jo hakemus tällä linkillä. Vahvista tallennus tai muuta linkkiä.' })
    updateMessage(message.id, { saving: true, error: '' })
    try {
      const created = await apiRequest(getToken, '/applications', { method: 'POST', body: {
        company,
        role,
        place: message.fields.place.trim(),
        link: safeHttpUrl(link),
        notes: message.fields.notes.trim(),
        status: 'Kiinnostava',
        added: today(),
      } })
      onApplicationCreated?.(created)
      setMessages((all) => [...all.map((item) => item.id === message.id ? { ...item, saving: false, saved: true } : item),
        { id: localId('assistant'), role: 'assistant', content: `Hakemus tallennettu: ${created.company} · ${created.role}. Löydät sen Hakemukset-sivulta vaiheesta Kiinnostava.` },
      ])
    } catch (saveError) { updateMessage(message.id, { saving: false, error: saveError.message }) }
  }

  async function sendMessage() {
    if (postingDraftMode) {
      const postingTextValue = draft.trim()
      if (postingTextValue && !sending && !historyLoading) await sendPostingDraft(postingTextValue)
      return
    }
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
      <div className="chat-messages" ref={chatMessagesRef}><article className="assistant-message"><b>Työpari</b><p>Voin ehdottaa hakemukseen kohdennettuja muutoksia valitsemiesi tietojen pohjalta. Ehdotus ei tallennu hakemukseen ennen kuin hyväksyt sen itse.</p><small>Työpaikkailmoituksen lukemiseen liitä sen teksti sivupaneelin kenttään.</small></article>{historyLoading && <p className="permission-empty">Ladataan keskusteluhistoriaa…</p>}{visibleMessages.map((message, index) => message.role === 'posting-draft' ? <PostingDraftMessage key={message.id} message={message} jobs={jobs} onChange={(fields) => updateMessage(message.id, { fields, error: '' })} onAcknowledge={(acknowledgedLink) => updateMessage(message.id, { acknowledgedLink, error: '' })} onSave={() => savePostingDraft(message)} /> : <article className={message.role === 'user' ? 'user-message' : 'assistant-message'} key={message.id || index}><b>{message.role === 'user' ? 'Sinun pyyntösi' : 'Työpari · ehdotus'}</b><p>{message.content}</p>{message.role === 'assistant' && <small>Voit kopioida ehdotuksen ja hyväksyä muokkauksen itse hakemuksessa.</small>}</article>)}</div>
      {error && <p className="assistant-error" role="alert">{error}</p>}<label className="chat-composer">Viesti työparille<textarea rows="3" maxLength={postingDraftMode ? 16000 : 4000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage() } }} placeholder={postingDraftMode ? 'Liitä työpaikkailmoituksen teksti ja linkki…' : 'Kirjoita viesti työparille…'} /></label><button className="add-button chat-send" onClick={sendMessage} disabled={postingDraftMode ? !draft.trim() || sending || historyLoading : !job || (!context.allowSuggestions && !isApplicationInfoQuestion(draft)) || !draft.trim() || sending || historyLoading}>{sending ? (postingDraftMode ? 'Luetaan ilmoitusta…' : 'Lähetetään…') : 'Lähetä viesti'}</button>
    </section>
    <aside className="paper assistant-permissions"><h3>Valitse keskustelun konteksti</h3><div className={`application-picker${postingDraftMode ? ' is-context-locked' : ''}`} ref={applicationPickerRef} onKeyDown={(event) => { if (event.key === 'Escape') { setApplicationPickerOpen(false); applicationPickerTriggerRef.current?.focus() } }}><span className="application-picker-label">Hakemus</span><button ref={applicationPickerTriggerRef} type="button" className="application-picker-trigger" disabled={postingDraftMode} aria-haspopup="listbox" aria-expanded={applicationPickerOpen} onClick={() => setApplicationPickerOpen((open) => !open)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setApplicationPickerOpen(true) } }}>{job ? `${job.company} · ${job.role}` : 'Valitse hakemus'}<span aria-hidden="true">⌄</span></button>{applicationPickerOpen && <div className="application-picker-options" role="listbox" aria-label="Valitse hakemus"><button type="button" role="option" aria-selected={!jobId} className={!jobId ? 'is-selected' : ''} onClick={() => chooseJob('')}>Valitse hakemus</button>{jobs.map((item) => <button type="button" role="option" aria-selected={String(item.id) === String(jobId)} className={String(item.id) === String(jobId) ? 'is-selected' : ''} key={item.id} onClick={() => chooseJob(item.id)}>{item.company} · {item.role}</button>)}</div>}</div>
      {job && <div className={`permission-list${postingDraftMode ? ' is-context-locked' : ''}`}><small>AI käyttää tietoa vain, kun kytket sen erikseen:</small><label><input type="checkbox" checked={context.posting} disabled={postingDraftMode} onChange={() => toggle('posting')} /> Työpaikkailmoitus {job.link ? '· luetaan tallennetusta HTTPS-linkistä' : '· linkkiä ei ole tallennettu'}</label>{context.posting && <textarea className="posting-context" disabled={postingDraftMode} rows="5" maxLength="16000" value={postingText} onChange={(event) => setPostingText(event.target.value)} placeholder="Voit liittää ilmoituksen tekstin tähän, jos linkin automaattinen luku ei onnistu." />}<label><input type="checkbox" checked={context.cv} disabled={postingDraftMode} onChange={() => toggle('cv')} /> Valittu CV {cv ? '· ' + cv.name : '· valitse CV hakemukselle'}</label><label><input type="checkbox" checked={context.template} disabled={postingDraftMode} onChange={() => toggle('template')} /> Hakemuspohja {template ? '· ' + template.name : '· ei valittua pohjaa'}</label><label><input type="checkbox" checked={context.application} disabled={postingDraftMode} onChange={() => toggle('application')} /> Tämän hakemuksen muistiinpanot</label><hr/><label className="approval-choice"><input type="checkbox" checked={context.allowSuggestions} disabled={postingDraftMode} onChange={() => toggle('allowSuggestions')} /> AI saa ehdottaa muutoksia tähän hakemukseen. Mitään ei tallenneta ennen hyväksyntääni.</label></div>}
      {!job && <p className="permission-empty">Valitse hakemus, niin voit kysyä sen tiedoista tai pyytää AI:lta ehdotuksia.</p>}
      <div className="permission-list posting-draft-section"><span className="application-picker-label">Uusi hakemus ilmoituksesta</span><label><input type="checkbox" checked={postingDraftMode} onChange={(event) => { setPostingDraftMode(event.target.checked); setApplicationPickerOpen(false) }} /> Tee hakemuspohja ilmoituksesta</label><p className="permission-empty">Liitä ilmoituksen teksti ja linkki viestikenttään. Pohja tallennetaan vasta, kun hyväksyt sen.</p></div><p className="privacy-note">Hakemuksen tiedot luetaan DuuniCheckin tietokannasta, eikä niitä lähetetä OpenAI:lle tietokantakysymyksissä. AI-ehdotuksiin lähetetään vain viesti ja erikseen valitsemasi lisätiedot. Keskustelut tallennetaan hakemuksen yhteyteen.</p>
    </aside></div>
  </div>
}
