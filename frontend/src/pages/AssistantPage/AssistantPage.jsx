import './AssistantPage.css'
import { useState } from 'react'
export default function AssistantPage({ jobs, cvs, templates, initialJobId }) {
  const [jobId, setJobId] = useState(initialJobId || '')
  const [context, setContext] = useState({ posting: false, cv: false, template: false, application: false, allowSuggestions: false })
  const [draft, setDraft] = useState('')
  const job = jobs.find((item) => String(item.id) === String(jobId))
  const cv = cvs.find((item) => item.id === job?.cvId)
  const template = templates.find((item) => item.id === job?.templateId)
  const toggle = (key) => setContext((current) => ({ ...current, [key]: !current[key] }))
  return <div className="assistant-page">
    <section className="assistant-intro"><div><span className="eyebrow">OMA TYÖNHAUN AI-TYÖPARI</span><h2>Ajattele yhdessä. Hyväksy itse.</h2><p>AI voi lukea valitsemasi ilmoituksen, verrata sitä CV:hen ja pohjaan sekä ehdottaa kohdennettua hakemusta. Chat ei muuta tai tallenna materiaaleja ilman erillistä hyväksyntää.</p></div><span className="assistant-orb">✳</span></section>
    <div className="assistant-layout"><section className="paper assistant-chat"><div className="chat-header"><div><span className="chat-avatar">AI</span><span><b>DuuniCheck-työpari</b><small>Yksityinen hakemuskohtainen keskustelu</small></span></div><span className="connection-state">AI-yhteys kytketään backend-vaiheessa</span></div>
      <div className="chat-messages"><article className="assistant-message"><b>Työpari</b><p>Voin auttaa muokkaamaan hakemusta, nostamaan CV:stä tehtävään sopivat vahvuudet ja ehdottamaan parempia muotoiluja. Valitse ensin hakemus ja anna lupa niihin tietoihin, joita haluat käyttää.</p><small>Jokainen muutos näytetään ehdotuksena. Sinä hyväksyt sen ennen tallennusta.</small></article>{draft && <article className="user-message"><b>Sinun luonnoksesi</b><p>{draft}</p><small>Tallennettu vain tähän selainistuntoon. AI ei ole vielä vastaanottanut sitä.</small></article>}</div>
      <label className="chat-composer">Viesti työparille<textarea rows="3" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Esim. Korosta kokemustani saavutettavuudesta tässä hakemuksessa." /></label><button className="add-button chat-send" disabled>AI-yhteys lisätään backendissä</button>
    </section>
    <aside className="paper assistant-permissions"><h3>Valitse keskustelun konteksti</h3><label>Hakemus<select value={jobId} onChange={(event) => { setJobId(event.target.value); setDraft(''); setContext({ posting: false, cv: false, template: false, application: false, allowSuggestions: false }) }}><option value="">Valitse hakemus</option>{jobs.map((item) => <option key={item.id} value={item.id}>{item.company} · {item.role}</option>)}</select></label>
      {job && <div className="permission-list"><small>AI käyttää tietoa vain, kun kytket sen erikseen:</small><label><input type="checkbox" checked={context.posting} onChange={() => toggle('posting')} /> Työpaikkailmoituksen linkki {job.link ? '· lisätty' : '· linkkiä ei ole'}</label><label><input type="checkbox" checked={context.cv} onChange={() => toggle('cv')} /> Valittu CV {cv ? '· ' + cv.name : '· valitse CV hakemukselle'}</label><label><input type="checkbox" checked={context.template} onChange={() => toggle('template')} /> Hakemuspohja {template ? '· ' + template.name : '· ei valittua pohjaa'}</label><label><input type="checkbox" checked={context.application} onChange={() => toggle('application')} /> Tämän hakemuksen teksti</label><hr/><label className="approval-choice"><input type="checkbox" checked={context.allowSuggestions} onChange={() => toggle('allowSuggestions')} /> AI saa ehdottaa muutoksia tähän hakemukseen. Mitään ei tallenneta ennen hyväksyntääni.</label></div>}
      {!job && <p className="permission-empty">Valitse hakemus, niin voit päättää mitä tietoja keskustelussa käytetään.</p>}<p className="privacy-note">Tässä prototyypissä tietoja ei lähetetä AI-palveluun. Backendissä toteutetaan kirjautuminen, suostumuksen tarkistus ja ehdotusten hyväksyntä.</p>
    </aside></div>
  </div>
}
