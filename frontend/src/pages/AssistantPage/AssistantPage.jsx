import './AssistantPage.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import { apiRequest, uploadImportFile } from '../../api'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import MarkdownText from '../../components/MarkdownText/MarkdownText'
import DeleteApplicationsMessage from './DeleteApplicationsMessage'
import ImportApplicationsMessage from './ImportApplicationsMessage'
import { buildImportRows, checkImportFile, importAccept, rowSavable } from './importRows'
import { assistantChatFields, isToolMessage } from './assistantChatState'
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
// The recruiter line is set by the server when an agency hides the employer.
function postingDraftNotes({ deadline, recruiterNote }) {
  const [year, month, day] = (deadline || '').split('-')
  return [deadline && `Haku päättyy: ${day}.${month}.${year}`, recruiterNote].filter(Boolean).join('\n')
}

// Local list covers links edited after parsing; the server result covers the parsed link.
function findDuplicate(message, jobs) {
  const local = message.fields.link.trim() ? jobs.find((job) => sameLink(job.link, message.fields.link)) : null
  if (local) return local
  return message.serverDuplicate && sameLink(message.serverDuplicate.link, message.fields.link)
    ? message.serverDuplicate
    : null
}

function PostingDraftMessage({ message, jobs, onChange, onAcknowledge, onSave, onClose }) {
  const { fields, saving, saved, error } = message
  const duplicate = findDuplicate(message, jobs)
  const acknowledged = Boolean(duplicate) && message.acknowledgedLink === fields.link
  const field = (name) => ({
    value: fields[name],
    onChange: (event) => onChange({ ...fields, [name]: event.target.value }),
  })
  return (
    <article className="assistant-message posting-draft-message">
      <b>Työpari · hakemuspohja</b>
      <p>
        {saved
          ? 'Tämä pohja on tallennettu hakemukseksi.'
          : 'Tarkista ja korjaa tiedot ennen tallennusta. Tyhjät kentät eivät löytyneet ilmoituksen tekstistä.'}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <fieldset disabled={saving || saved}>
          <label>
            Yritys
            <input maxLength="160" required {...field('company')} />
          </label>
          <label>
            Tehtävä
            <input maxLength="160" required {...field('role')} />
          </label>
          <label>
            Paikkakunta
            <input maxLength="160" {...field('place')} />
          </label>
          <label>
            Linkki
            <input type="url" inputMode="url" maxLength="2048" placeholder="https://…" {...field('link')} />
          </label>
          <label>
            Muistiinpanot
            <textarea rows="2" maxLength="8000" {...field('notes')} />
          </label>
          {duplicate && !saved && (
            <div className="posting-duplicate" role="alert">
              <span>
                Sinulla on jo hakemus tällä linkillä:{' '}
                <b>
                  {duplicate.company} · {duplicate.role}
                </b>
                .
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => onAcknowledge(event.target.checked ? fields.link : null)}
                />{' '}
                Tallenna silti uutena hakemuksena
              </label>
            </div>
          )}
          {error && (
            <span className="assistant-error" role="alert">
              {error}
            </span>
          )}
          {!saved && (
            <button
              type="submit"
              className="add-button chat-send"
              disabled={saving || !fields.company.trim() || !fields.role.trim() || (duplicate && !acknowledged)}
            >
              {saving ? 'Tallennetaan…' : 'Tallenna hakemus'}
            </button>
          )}
        </fieldset>
      </form>
      {!saved && <small>Hakemus tallennetaan vaiheeseen Kiinnostava.</small>}
      {!saving && (
        <button type="button" className="import-link message-close" onClick={onClose}>
          Sulje pohja
        </button>
      )}
    </article>
  )
}

// "Hakukirje · pohja: Kehittäjä", "Hakukirje · hakukirje.pdf" or "Hakukirje · pohja ja 1 tiedosto".
function describeCoverLetter(template, hasApplicationText, coverLetterFiles) {
  const fileCount = coverLetterFiles.length
  const fileText = fileCount === 1 ? '1 tiedosto' : `${fileCount} tiedostoa`
  const parts = [template && 'pohja', hasApplicationText && 'hakemusteksti', fileCount > 0 && fileText].filter(Boolean)
  if (!parts.length) return 'Hakukirje · ei hakukirjettä tällä hakemuksella'
  if (parts.length === 1 && template) return `Hakukirje · pohja: ${template.name}`
  if (parts.length === 1 && fileCount === 1) return `Hakukirje · ${coverLetterFiles[0].name}`
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ja ${parts.at(-1)}` : parts[0]
  return `Hakukirje · ${list}`
}

function isApplicationInfoQuestion(value) {
  const asksForFacts =
    /(tila|tilanne|vaihe|status|milloin|päivä|lähetetty|lähetyspäivä|vastaus|vastannut|haastattel|tapahtum|historia|muistut|seuraava|yritys|tehtävä|muistiinpano)/i.test(
      value,
    )
  const asksAboutTheSelectedApplication = /(mitä|kerro|näytä|listaa).*(hakemuks|hausta|valitusta)/i.test(value)
  const asksForApplicationDetails =
    /(tiedot|tietoja)/i.test(value) && /(hakemuks|hausta|valitusta|tästä|tästä hausta)/i.test(value)
  return asksForFacts || asksAboutTheSelectedApplication || asksForApplicationDetails
}

export default function AssistantPage({
  chat,
  setChat,
  jobs,
  cvs,
  templates,
  files = [],
  initialJobId,
  onSelectJob,
  onApplicationCreated,
  onApplicationsDeleted,
}) {
  const { getToken } = useAuth()
  const [jobId, setJobId] = useState(initialJobId || '')
  // Chat state is owned by App (memory only), so it survives tab switches and remounts.
  const {
    context,
    draft,
    postingText,
    messages,
    sending,
    postingDraftMode,
    importMode,
    deleteMode,
    attachedFile,
    loadedForJobId,
  } = chat
  const setters = useMemo(
    () =>
      Object.fromEntries(
        assistantChatFields.map((key) => [
          key,
          (value) =>
            setChat((current) => ({ ...current, [key]: typeof value === 'function' ? value(current[key]) : value })),
        ]),
      ),
    [setChat],
  )
  const {
    context: setContext,
    draft: setDraft,
    postingText: setPostingText,
    messages: setMessages,
    sending: setSending,
    postingDraftMode: setPostingDraftMode,
    importMode: setImportMode,
    deleteMode: setDeleteMode,
    attachedFile: setAttachedFile,
    loadedForJobId: setLoadedForJobId,
  } = setters
  const [dropActive, setDropActive] = useState(false)
  const fileInputRef = useRef(null)
  // Pending confirmation for undoing an import or deleting found applications; nothing is deleted before it is confirmed.
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  // Each tool mode locks the other context choices.
  const contextLocked = postingDraftMode || importMode || deleteMode
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
  // The CV choice sends the app CV and the attached CV file, so the label names what is included.
  const cvFile = files.find((item) => item.id === job?.cvFileId)
  const hasCv = Boolean(cv || cvFile)
  const cvLabel = hasCv
    ? ['Valittu CV', cv?.name, cvFile && `CV-tiedosto: ${cvFile.name}`].filter(Boolean).join(' · ')
    : 'CV · ei CV:tä tällä hakemuksella'

  // The cover letter choice sends all cover letter material: the app template, the application's
  // own text and the attached application files.
  const coverLetterFiles = files.filter((item) => (job?.applicationFileIds || []).includes(item.id))
  const hasCoverLetter = Boolean(template || job?.hasApplicationText || coverLetterFiles.length)
  const coverLetterLabel = describeCoverLetter(template, Boolean(job?.hasApplicationText), coverLetterFiles)
  const hasNotes = Boolean(job?.notes?.trim())

  // A choice only counts while the application has that material, so a choice made for another
  // application never stays on a disabled row.
  const available = { cv: hasCv, coverLetter: hasCoverLetter, application: hasNotes }
  const isChosen = (key) => Boolean(context[key]) && (available[key] ?? true)
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
    // The previous application's history must not stay visible; this session's tool messages are kept.
    setMessages((all) => all.filter(isToolMessage))
    setError('')
    setDraft('')
    setContext({
      posting: false,
      cv: false,
      coverLetter: false,
      application: false,
      allowSuggestions: false,
    })
    setApplicationPickerOpen(false)
  }

  useEffect(() => {
    if (!jobId || loadedForJobId === jobId) return undefined
    let active = true
    apiRequest(getToken, `/conversations/${jobId}`)
      .then(({ messages: history }) => {
        if (active) {
          setMessages((all) => [...history, ...all.filter(isToolMessage)])
          setLoadedForJobId(jobId)
        }
      })
      .catch((loadError) => {
        if (active) {
          setMessages((all) => all.filter(isToolMessage))
          setError(loadError.message)
          setLoadedForJobId(jobId)
        }
      })
    return () => {
      active = false
    }
  }, [getToken, jobId, loadedForJobId, setLoadedForJobId, setMessages])

  // Scroll only when a new message arrives (the last message changes), not while rows inside a message are edited or selected.
  const lastMessageId = visibleMessages.at(-1)?.id
  useEffect(() => {
    if (historyLoading || !chatMessagesRef.current) return undefined
    const chat = chatMessagesRef.current
    const scrollToLatest = () => {
      chat.scrollTop = chat.scrollHeight
    }
    scrollToLatest()
    const frame = window.requestAnimationFrame(scrollToLatest)
    return () => window.cancelAnimationFrame(frame)
  }, [historyLoading, jobId, lastMessageId])

  const closeMessage = (id) => setMessages((all) => all.filter((item) => item.id !== id))
  const updateMessage = (id, patch) =>
    setMessages((all) => all.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  // Posting drafts are local chat messages: parse-posting stores nothing and the conversation history is not touched.
  async function sendPostingDraft(postingTextValue) {
    const link = extractPostingLink(postingTextValue)
    setSending(true)
    setError('')
    try {
      const result = await apiRequest(getToken, '/assistant/parse-posting', {
        method: 'POST',
        body: { postingText: postingTextValue, link },
      })
      const { company, role, place, link: parsedLink } = result.draft
      setMessages((all) => [
        ...all,
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
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  async function savePostingDraft(message) {
    const company = message.fields.company.trim()
    const role = message.fields.role.trim()
    const link = message.fields.link.trim()
    if (!company || !role) return updateMessage(message.id, { error: 'Yritys ja tehtävä ovat pakollisia.' })
    if (link && !safeHttpUrl(link))
      return updateMessage(message.id, { error: 'Tarkista linkki: sen pitää alkaa http:// tai https://.' })
    if (findDuplicate(message, jobs) && message.acknowledgedLink !== message.fields.link)
      return updateMessage(message.id, {
        error: 'Sinulla on jo hakemus tällä linkillä. Vahvista tallennus tai muuta linkkiä.',
      })
    updateMessage(message.id, { saving: true, error: '' })
    try {
      const created = await apiRequest(getToken, '/applications', {
        method: 'POST',
        body: {
          company,
          role,
          place: message.fields.place.trim(),
          link: safeHttpUrl(link),
          notes: message.fields.notes.trim(),
          status: 'Kiinnostava',
          added: today(),
        },
      })
      onApplicationCreated?.(created)
      setMessages((all) => [
        ...all.map((item) => (item.id === message.id ? { ...item, saving: false, saved: true } : item)),
        {
          id: localId('assistant'),
          role: 'assistant',
          content: `Hakemus tallennettu: ${created.company} · ${created.role}. Löydät sen Hakemukset-sivulta vaiheesta Kiinnostava.`,
        },
      ])
    } catch (saveError) {
      updateMessage(message.id, { saving: false, error: saveError.message })
    }
  }

  function attachFile(file) {
    if (!file) return
    const problem = checkImportFile(file)
    setError(problem)
    setAttachedFile(problem ? null : file)
  }

  // Import results are local chat messages like posting drafts: nothing is saved before the user saves the selected rows.
  async function sendImport() {
    if (!attachedFile || sending) return
    const file = attachedFile
    setSending(true)
    setError('')
    try {
      const result = await uploadImportFile(getToken, file)
      setMessages((all) => [
        ...all,
        { id: localId('user'), role: 'user', content: `Liitetty tiedosto: ${file.name}` },
        {
          id: localId('import'),
          role: 'import-result',
          fileName: result.fileName || file.name,
          table: result.table,
          notices: result.notices || [],
          capacity: result.capacity,
          rows: buildImportRows(result.applications, result.capacity),
          savedKeys: [],
          saving: false,
          remapping: false,
          error: '',
        },
      ])
      setAttachedFile(null)
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  // A changed column mapping is applied again on the server without a new OpenAI request.
  async function remapImport(message, mapping) {
    const table = { ...message.table, mapping }
    updateMessage(message.id, { table, remapping: true, error: '' })
    try {
      const result = await apiRequest(getToken, '/assistant/import-applications/remap', {
        method: 'POST',
        body: { table: { sheets: table.sheets, mapping, statusMap: table.statusMap } },
      })
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id && item.table.mapping === mapping
            ? { ...item, remapping: false, rows: buildImportRows(result.applications, item.capacity, item.savedKeys) }
            : item,
        ),
      )
    } catch (remapError) {
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id && item.table.mapping === mapping
            ? { ...item, remapping: false, error: remapError.message }
            : item,
        ),
      )
    }
  }

  async function saveImported(message) {
    const targets = message.rows.filter((row) => row.selected && rowSavable(row))
    if (!targets.length || message.saving) return
    updateMessage(message.id, { saving: true, error: '' })
    const savedKeys = []
    const createdIds = []
    const failures = []
    // One at a time, so the 500 application limit is checked for each row.
    for (const { key, fields } of targets) {
      try {
        const created = await apiRequest(getToken, '/applications', {
          method: 'POST',
          body: {
            company: fields.company.trim(),
            role: fields.role.trim(),
            place: fields.place.trim(),
            link: safeHttpUrl(fields.link.trim()),
            status: fields.status,
            added: fields.added,
            respondedAt: fields.respondedAt,
            next: fields.next.trim(),
            nextDate: fields.nextDate,
            notes: fields.notes.trim(),
            applicationText: fields.applicationText.trim(),
            events: fields.events
              .filter((event) => event.type)
              .map(({ id, type, date, note }) => ({ id, type, date, note: note || '' })),
          },
        })
        onApplicationCreated?.(created)
        savedKeys.push(key)
        createdIds.push(String(created.id))
      } catch (saveError) {
        failures.push(`${fields.company} · ${fields.role}: ${saveError.message}`)
      }
    }
    const summary = [
      `Tallennettiin ${savedKeys.length} hakemusta${savedKeys.length ? '. Löydät ne Hakemukset-sivulta.' : '.'}`,
      failures.length ? `${failures.length} epäonnistui:\n${failures.map((line) => `• ${line}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    setMessages((all) => [
      ...all.map((item) =>
        item.id === message.id
          ? {
              ...item,
              saving: false,
              savedKeys: [...item.savedKeys, ...savedKeys],
              createdIds: [...(item.createdIds || []), ...createdIds],
              rows: item.rows.map((row) =>
                savedKeys.includes(row.key) ? { ...row, saved: true, selected: false, open: false } : row,
              ),
            }
          : item,
      ),
      { id: localId('assistant'), role: 'assistant', content: summary },
    ])
  }

  // The model only turns the request into search criteria; the server searches the user's own applications.
  async function findDeletable(text) {
    setSending(true)
    setError('')
    try {
      const result = await apiRequest(getToken, '/assistant/find-applications', {
        method: 'POST',
        body: { message: text },
      })
      setMessages((all) => [
        ...all,
        { id: localId('user'), role: 'user', content: text },
        {
          id: localId('delete'),
          role: 'delete-search',
          description: result.description || [],
          needsDetail: Boolean(result.needsDetail),
          rows: (result.applications || []).map((row) => ({ ...row, selected: true, deleted: false })),
          deleting: false,
          done: false,
          error: '',
        },
      ])
      setDraft('')
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  function requestUndo(message) {
    const ids = message.createdIds || []
    if (!ids.length) return
    setPendingDelete({
      kind: 'undo',
      messageId: message.id,
      ids,
      title: `Poistetaanko ${ids.length} tuotua hakemusta?`,
      description: 'Tätä ei voi perua.',
    })
  }

  function requestDelete(message) {
    const selected = message.rows.filter((row) => row.selected && !row.deleted)
    if (!selected.length) return
    const names = selected.slice(0, 5).map((row) => row.company)
    const more = selected.length > 5 ? ` ja ${selected.length - 5} muuta` : ''
    setPendingDelete({
      kind: 'delete',
      messageId: message.id,
      ids: selected.map((row) => row.id),
      title: `Poistetaanko ${selected.length} hakemusta?`,
      description: `Tätä ei voi perua. Poistettavat: ${names.join(', ')}${more}.`,
    })
  }

  // Runs only after the user confirmed in the dialog.
  async function confirmPendingDelete() {
    if (!pendingDelete || confirmBusy) return
    const { kind, messageId, ids } = pendingDelete
    setConfirmBusy(true)
    updateMessage(messageId, kind === 'undo' ? { undoing: true, error: '' } : { deleting: true, error: '' })
    try {
      const { deleted } = await apiRequest(getToken, '/applications/bulk-delete', { method: 'POST', body: { ids } })
      const removed = new Set(ids)
      onApplicationsDeleted?.(ids)
      if (removed.has(String(jobId))) {
        // The selected application and its conversation are gone; keep only this session's local messages.
        setJobId('')
        setLoadedForJobId('')
      }
      setMessages((all) => [
        ...all
          .filter((item) => !(removed.has(String(jobId)) && /^[a-f\d]{24}$/i.test(String(item.id))))
          .map((item) => {
            if (item.id !== messageId) return item
            if (kind === 'undo')
              return {
                ...item,
                undoing: false,
                createdIds: [],
                rows: item.rows.map((row) => (row.saved && !row.undone ? { ...row, undone: true } : row)),
              }
            return {
              ...item,
              deleting: false,
              done: true,
              rows: item.rows.map((row) => (removed.has(row.id) ? { ...row, deleted: true, selected: false } : row)),
            }
          }),
        {
          id: localId('assistant'),
          role: 'assistant',
          content:
            kind === 'undo'
              ? `Tuonti kumottu: poistettiin ${deleted} tuotua hakemusta.`
              : `Poistettiin ${deleted} hakemusta.`,
        },
      ])
      setPendingDelete(null)
    } catch (deleteError) {
      updateMessage(
        messageId,
        kind === 'undo'
          ? { undoing: false, error: deleteError.message }
          : { deleting: false, error: deleteError.message },
      )
      setPendingDelete(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  async function sendMessage() {
    if (deleteMode) {
      const text = draft.trim()
      if (text && !sending) await findDeletable(text)
      return
    }
    if (importMode) {
      await sendImport()
      return
    }
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
      const result = await apiRequest(
        getToken,
        localQuestion ? `/conversations/${job.id}/answer` : '/assistant/suggest',
        {
          method: 'POST',
          body: localQuestion
            ? { message: selectedMessage }
            : {
                message: selectedMessage,
                context: {
                  applicationId: String(job.id),
                  includePosting: context.posting,
                  postingText: context.posting ? postingText : '',
                  includeCv: isChosen('cv'),
                  // One cover letter choice covers both the template and the application text and files.
                  includeTemplate: isChosen('coverLetter'),
                  includeApplicationText: isChosen('coverLetter'),
                  includeApplication: isChosen('application'),
                  allowSuggestions: true,
                },
              },
        },
      )
      const answer = localQuestion ? result.answer : result.suggestion
      setMessages((all) => [
        ...all,
        { id: `user-${Date.now()}`, role: 'user', content: selectedMessage },
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
          // Shown with this answer only: which attached texts were shortened or could not be read.
          notices: localQuestion ? [] : result.notices || [],
        },
      ])
      setDraft('')
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="assistant-page">
      <div className="assistant-layout">
        <section className="paper assistant-chat">
          <div className="chat-header">
            <div>
              <span className="chat-avatar">AI</span>
              <span>
                <b>DuuniCheck-työpari</b>
                <small>
                  {job
                    ? 'Yksityinen, hakemuskohtainen tallennettu keskustelu'
                    : 'Keskustelu säilyy, kunnes päivität sivun tai kirjaudut ulos.'}
                </small>
              </span>
            </div>
            <span className="connection-state">
              Hakemustiedot haetaan omasta tietokannasta. AI auttaa ehdotuksissa.
            </span>
          </div>
          <div className="chat-messages" ref={chatMessagesRef}>
            <article className="assistant-message">
              <b>Työpari</b>
              <p>
                Voin ehdottaa hakemukseen kohdennettuja muutoksia valitsemiesi tietojen pohjalta. Ehdotus ei tallennu
                hakemukseen ennen kuin hyväksyt sen itse.
              </p>
              <small>Työpaikkailmoituksen lukemiseen liitä sen teksti sivupaneelin kenttään.</small>
            </article>
            {historyLoading && <p className="permission-empty">Ladataan keskusteluhistoriaa…</p>}
            {visibleMessages.map((message, index) =>
              message.role === 'delete-search' ? (
                <DeleteApplicationsMessage
                  key={message.id}
                  message={message}
                  onChange={(patch) => updateMessage(message.id, patch)}
                  onDelete={() => requestDelete(message)}
                  onClose={() => closeMessage(message.id)}
                />
              ) : message.role === 'import-result' ? (
                <ImportApplicationsMessage
                  key={message.id}
                  message={message}
                  jobs={jobs}
                  onChange={(patch) => updateMessage(message.id, patch)}
                  onRemap={(mapping) => remapImport(message, mapping)}
                  onSave={() => saveImported(message)}
                  onUndo={() => requestUndo(message)}
                  onClose={() => closeMessage(message.id)}
                />
              ) : message.role === 'posting-draft' ? (
                <PostingDraftMessage
                  key={message.id}
                  message={message}
                  jobs={jobs}
                  onChange={(fields) => updateMessage(message.id, { fields, error: '' })}
                  onAcknowledge={(acknowledgedLink) => updateMessage(message.id, { acknowledgedLink, error: '' })}
                  onSave={() => savePostingDraft(message)}
                  onClose={() => closeMessage(message.id)}
                />
              ) : (
                <article
                  className={message.role === 'user' ? 'user-message' : 'assistant-message'}
                  key={message.id || index}
                >
                  <b>{message.role === 'user' ? 'Sinun pyyntösi' : 'Työpari · ehdotus'}</b>
                  {/* AI answers (also from the saved history) are formatted; the user's own text stays plain. */}
                  {message.role === 'user' ? <p>{message.content}</p> : <MarkdownText text={message.content} />}
                  {message.notices?.map((notice) => (
                    <small className="assistant-notice" key={notice}>
                      {notice}
                    </small>
                  ))}
                  {message.role === 'assistant' && (
                    <small>Voit kopioida ehdotuksen ja hyväksyä muokkauksen itse hakemuksessa.</small>
                  )}
                </article>
              ),
            )}
          </div>
          {error && (
            <p className="assistant-error" role="alert">
              {error}
            </p>
          )}
          <label className="chat-composer">
            Viesti työparille
            <textarea
              className={dropActive ? 'is-drop-target' : undefined}
              rows="3"
              maxLength={postingDraftMode ? 16000 : deleteMode ? 2000 : 4000}
              value={importMode ? '' : draft}
              readOnly={importMode}
              onChange={(event) => setDraft(event.target.value)}
              onDragOver={(event) => {
                if (!importMode) return
                event.preventDefault()
                setDropActive(true)
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(event) => {
                setDropActive(false)
                if (!importMode) return
                event.preventDefault()
                attachFile(event.dataTransfer.files?.[0])
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder={
                deleteMode
                  ? 'Esim. poista eilen lisätyt hylätyt hakemukset…'
                  : importMode
                    ? 'Liitä tiedosto paperiliittimellä tai vedä se tähän.'
                    : postingDraftMode
                      ? 'Liitä työpaikkailmoituksen teksti ja linkki…'
                      : 'Kirjoita viesti työparille…'
              }
            />
          </label>
          {importMode && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={importAccept}
                hidden
                onChange={(event) => {
                  attachFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                className="chat-attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="Liitä tiedosto"
                title="Liitä tiedosto"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M10.5 4.5 5.8 9.2a1.5 1.5 0 0 0 2.1 2.1l5-5a3 3 0 0 0-4.2-4.2l-5 5a4.5 4.5 0 0 0 6.4 6.4l4.2-4.2" />
                </svg>
              </button>
              {attachedFile && (
                <span className="chat-attachment">
                  <span>{attachedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    disabled={sending}
                    aria-label="Poista liite"
                  >
                    ×
                  </button>
                </span>
              )}
            </>
          )}
          <button
            className="add-button chat-send"
            onClick={sendMessage}
            disabled={
              deleteMode
                ? !draft.trim() || sending
                : importMode
                  ? !attachedFile || sending
                  : postingDraftMode
                    ? !draft.trim() || sending || historyLoading
                    : !job ||
                      (!context.allowSuggestions && !isApplicationInfoQuestion(draft)) ||
                      !draft.trim() ||
                      sending ||
                      historyLoading
            }
          >
            {sending
              ? deleteMode
                ? 'Etsitään…'
                : importMode
                  ? 'Luetaan tiedostoa…'
                  : postingDraftMode
                    ? 'Luetaan ilmoitusta…'
                    : 'Lähetetään…'
              : 'Lähetä viesti'}
          </button>
        </section>
        <aside className="paper assistant-permissions">
          <h3>Valitse keskustelun konteksti</h3>
          <div
            className={`application-picker${contextLocked ? ' is-context-locked' : ''}`}
            ref={applicationPickerRef}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setApplicationPickerOpen(false)
                applicationPickerTriggerRef.current?.focus()
              }
            }}
          >
            <span className="application-picker-label">Hakemus</span>
            <button
              ref={applicationPickerTriggerRef}
              type="button"
              className="application-picker-trigger"
              disabled={contextLocked}
              aria-haspopup="listbox"
              aria-expanded={applicationPickerOpen}
              onClick={() => setApplicationPickerOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setApplicationPickerOpen(true)
                }
              }}
            >
              {job ? `${job.company} · ${job.role}` : 'Valitse hakemus'}
              <span aria-hidden="true">⌄</span>
            </button>
            {applicationPickerOpen && (
              <div className="application-picker-options" role="listbox" aria-label="Valitse hakemus">
                <button
                  type="button"
                  role="option"
                  aria-selected={!jobId}
                  className={!jobId ? 'is-selected' : ''}
                  onClick={() => chooseJob('')}
                >
                  Valitse hakemus
                </button>
                {jobs.map((item) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(item.id) === String(jobId)}
                    className={String(item.id) === String(jobId) ? 'is-selected' : ''}
                    key={item.id}
                    onClick={() => chooseJob(item.id)}
                  >
                    {item.company} · {item.role}
                  </button>
                ))}
              </div>
            )}
          </div>
          {job && (
            <div className={`permission-list${contextLocked ? ' is-context-locked' : ''}`}>
              <small>AI käyttää tietoa vain, kun kytket sen erikseen:</small>
              <label>
                <input
                  type="checkbox"
                  checked={context.posting}
                  disabled={contextLocked}
                  onChange={() => toggle('posting')}
                />{' '}
                Työpaikkailmoitus · liitä ilmoituksen teksti
              </label>
              {context.posting && (
                <textarea
                  className="posting-context"
                  disabled={contextLocked}
                  rows="5"
                  maxLength="16000"
                  value={postingText}
                  onChange={(event) => setPostingText(event.target.value)}
                  placeholder="Liitä ilmoituksen teksti tähän."
                />
              )}
              <label className={hasCv ? undefined : 'is-context-locked'}>
                <input
                  type="checkbox"
                  checked={isChosen('cv')}
                  disabled={contextLocked || !hasCv}
                  onChange={() => toggle('cv')}
                />{' '}
                {cvLabel}
              </label>
              <label className={hasCoverLetter ? undefined : 'is-context-locked'}>
                <input
                  type="checkbox"
                  checked={isChosen('coverLetter')}
                  disabled={contextLocked || !hasCoverLetter}
                  onChange={() => toggle('coverLetter')}
                />{' '}
                <span>
                  {coverLetterLabel}
                  {hasCoverLetter && (
                    <small className="permission-hint">Yhteystiedot poistetaan ennen lähetystä.</small>
                  )}
                </span>
              </label>
              <label className={hasNotes ? undefined : 'is-context-locked'}>
                <input
                  type="checkbox"
                  checked={isChosen('application')}
                  disabled={contextLocked || !hasNotes}
                  onChange={() => toggle('application')}
                />{' '}
                {hasNotes ? 'Tämän hakemuksen muistiinpanot' : 'Muistiinpanot · ei muistiinpanoja tällä hakemuksella'}
              </label>
              <hr />
              <label className="approval-choice">
                <input
                  type="checkbox"
                  checked={context.allowSuggestions}
                  disabled={contextLocked}
                  onChange={() => toggle('allowSuggestions')}
                />{' '}
                AI saa ehdottaa muutoksia tähän hakemukseen. Mitään ei tallenneta ennen hyväksyntääni.
              </label>
            </div>
          )}
          {!job && (
            <p className="permission-empty">
              Valitse hakemus, niin voit kysyä sen tiedoista tai pyytää AI:lta ehdotuksia.
            </p>
          )}
          <div className="permission-list posting-draft-section">
            <span className="application-picker-label">Uusi hakemus ilmoituksesta</span>
            <label className={importMode || deleteMode ? 'is-context-locked' : undefined}>
              <input
                type="checkbox"
                checked={postingDraftMode}
                disabled={importMode || deleteMode}
                onChange={(event) => {
                  setPostingDraftMode(event.target.checked)
                  setApplicationPickerOpen(false)
                }}
              />{' '}
              Tee hakemuspohja ilmoituksesta
            </label>
            <p className="permission-empty">
              Liitä ilmoituksen teksti ja linkki viestikenttään. Pohja tallennetaan vasta, kun hyväksyt sen.
            </p>
            <span className="application-picker-label">Tuo hakemuksia tiedostosta</span>
            <label className={postingDraftMode || deleteMode ? 'is-context-locked' : undefined}>
              <input
                type="checkbox"
                checked={importMode}
                disabled={postingDraftMode || deleteMode}
                onChange={(event) => {
                  setImportMode(event.target.checked)
                  setAttachedFile(null)
                  setError('')
                  setApplicationPickerOpen(false)
                }}
              />{' '}
              Tee hakemukset tiedostosta
            </label>
            <p className="permission-empty">Liitä Excel-, CSV-, Word-, PDF- tai tekstitiedosto viestikenttään.</p>
            <span className="application-picker-label">Poista hakemuksia</span>
            <label className={postingDraftMode || importMode ? 'is-context-locked' : undefined}>
              <input
                type="checkbox"
                checked={deleteMode}
                disabled={postingDraftMode || importMode}
                onChange={(event) => {
                  setDeleteMode(event.target.checked)
                  setError('')
                  setApplicationPickerOpen(false)
                }}
              />{' '}
              Etsi poistettavat hakemukset
            </label>
            <p className="permission-empty">
              Kerro, mitkä hakemukset haluat poistaa. Mitään ei poisteta ilman vahvistustasi.
            </p>
          </div>
          <p className="privacy-note">
            Kun kysyt hakemuksesi tiedoista, vastaus haetaan DuuniCheckistä, eikä tietoja lähetetä tekoälylle. Kun
            pyydät tekoälyltä ehdotuksia, sille lähtee vain viestisi ja ne tiedot, jotka olet itse valinnut. Kun teet
            hakemuksen ilmoituksesta tai tiedostosta, liittämäsi teksti lähetetään tekoälylle tietojen poimimiseksi,
            eikä mitään tallenneta ennen kuin hyväksyt sen. Jos valitset CV:n tai hakukirjeen, tekoälylle lähtee myös
            hakemukseen liitettyjen tiedostojen teksti, josta nimesi, yhteystietosi ja postiosoitteesi poistetaan ennen
            lähetystä. Tekoälyä ohjeistetaan olemaan kirjoittamatta nimeäsi tai yhteystietojasi vastaukseen.
            Poistopyynnöissä tekoälylle lähtee vain viestisi, ja poisto tehdään vasta vahvistuksesi jälkeen. Keskustelu
            tallentuu valitun hakemuksen yhteyteen.
          </p>
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.title || ''}
        description={pendingDelete?.description || ''}
        busy={confirmBusy}
        onConfirm={confirmPendingDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
