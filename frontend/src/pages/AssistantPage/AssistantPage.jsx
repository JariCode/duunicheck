import './AssistantPage.css'
import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiRequest } from '../../api'
export default function AssistantPage({ jobs, cvs, templates, initialJobId }) {
  const { getToken } = useAuth()
  const [jobId, setJobId] = useState(initialJobId || '')
  const [context, setContext] = useState({ posting: false, cv: false, template: false, application: false, allowSuggestions: false })
  const [draft, setDraft] = useState('')
  const [postingText, setPostingText] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const job = jobs.find((item) => String(item.id) === String(jobId))
  const cv = cvs.find((item) => item.id === job?.cvId)
  const template = templates.find((item) => item.id === job?.templateId)
  const toggle = (key) => setContext((current) => ({ ...current, [key]: !current[key] }))
  async function sendMessage() {
    if (!job || !context.allowSuggestions || !draft.trim() || sending) return
    setSending(true)
    setError('')
    const selectedMessage = draft.trim()
    try {
      const result = await apiRequest(getToken, '/assistant/suggest', { method: 'POST', body: {
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
      setMessages((all) => [...all, { question: selectedMessage, answer: result.suggestion }])
      setDraft('')
    } catch (sendError) { setError(sendError.message) }
    finally { setSending(false) }
  }
  return <div className="assistant-page">
    <section className="assistant-intro"><div><span className="eyebrow">OMA TYÖNHAUN AI-TYÖPARI</span><h2>Ajattele yhdessä. Hyväksy itse.</h2><p>AI voi käyttää liittämääsi työpaikkailmoitusta, verrata sitä CV:hen ja pohjaan sekä ehdottaa kohdennettua hakemusta. Chat ei muuta tai tallenna materiaaleja ilman erillistä hyväksyntää.</p></div><span className="assistant-orb">✳</span></section>
    <div className="assistant-layout"><section className="paper assistant-chat"><div className="chat-header"><div><span className="chat-avatar">AI</span><span><b>DuuniCheck-työpari</b><small>Yksityinen hakemuskohtainen keskustelu</small></span></div><span className="connection-state">Valitut tiedot lähetetään AI-palveluun</span></div>
      <div className="chat-messages"><article className="assistant-message"><b>Työpari</b><p>Voin ehdottaa hakemukseen kohdennettuja muutoksia valitsemiesi tietojen pohjalta. Ehdotus ei tallennu hakemukseen ennen kuin hyväksyt sen itse.</p><small>Työpaikkailmoituksen lukemiseen liitä sen teksti sivupaneelin kenttään.</small></article>{messages.map((message, index) => <div key={index}><article className="user-message"><b>Sinun pyyntösi</b><p>{message.question}</p></article><article className="assistant-message"><b>Työpari · ehdotus</b><p>{message.answer}</p><small>Voit kopioida ehdotuksen ja hyväksyä muokkauksen itse hakemuksessa.</small></article></div>)}</div>
      {error && <p className="assistant-error" role="alert">{error}</p>}<label className="chat-composer">Viesti työparille<textarea rows="3" maxLength="4000" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Esim. Ehdota tästä tehtävästä kiinnostunut ja selkeä hakemusteksti." /></label><button className="add-button chat-send" onClick={sendMessage} disabled={!job || !context.allowSuggestions || !draft.trim() || sending}>{sending ? 'Työpari miettii…' : 'Pyydä ehdotusta'}</button>
    </section>
    <aside className="paper assistant-permissions"><h3>Valitse keskustelun konteksti</h3><label>Hakemus<select value={jobId} onChange={(event) => { setJobId(event.target.value); setDraft(''); setContext({ posting: false, cv: false, template: false, application: false, allowSuggestions: false }) }}><option value="">Valitse hakemus</option>{jobs.map((item) => <option key={item.id} value={item.id}>{item.company} · {item.role}</option>)}</select></label>
      {job && <div className="permission-list"><small>AI käyttää tietoa vain, kun kytket sen erikseen:</small><label><input type="checkbox" checked={context.posting} onChange={() => toggle('posting')} /> Työpaikkailmoitus {job.link ? '· luetaan tallennetusta HTTPS-linkistä' : '· linkkiä ei ole tallennettu'}</label>{context.posting && <textarea className="posting-context" rows="5" maxLength="16000" value={postingText} onChange={(event) => setPostingText(event.target.value)} placeholder="Voit liittää ilmoituksen tekstin tähän, jos linkin automaattinen luku ei onnistu." />}<label><input type="checkbox" checked={context.cv} onChange={() => toggle('cv')} /> Valittu CV {cv ? '· ' + cv.name : '· valitse CV hakemukselle'}</label><label><input type="checkbox" checked={context.template} onChange={() => toggle('template')} /> Hakemuspohja {template ? '· ' + template.name : '· ei valittua pohjaa'}</label><label><input type="checkbox" checked={context.application} onChange={() => toggle('application')} /> Tämän hakemuksen teksti</label><hr/><label className="approval-choice"><input type="checkbox" checked={context.allowSuggestions} onChange={() => toggle('allowSuggestions')} /> AI saa ehdottaa muutoksia tähän hakemukseen. Mitään ei tallenneta ennen hyväksyntääni.</label></div>}
      {!job && <p className="permission-empty">Valitse hakemus, niin voit päättää mitä tietoja keskustelussa käytetään.</p>}<p className="privacy-note">Vain valitsemasi teksti lähetetään backendin kautta OpenAI API:in. Tiedot eivät päivity tai tallennu ilman hyväksyntääsi.</p>
    </aside></div>
  </div>
}
