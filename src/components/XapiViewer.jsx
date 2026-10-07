import { useEffect, useRef, useState } from 'react'
import { describeStatement } from '../xapiText.js'

const STATUS = { sending: 'Sending…', stored: '✓ Stored', failed: '✗ Not stored' }
const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// A look behind the curtain, for demos: a small "{ } xAPI" button in the footer opens a dialog listing
// the xAPI the quiz has sent, as it's sent. Each statement in plain words (who, did what, to what, and
// the result), whether the LRS has it, and its JSON. Quiet, but a real button: reachable by keyboard
// and named for screen readers. The dialog is the browser's own modal (focus stays in it, Escape
// closes it, focus goes back to the button).
export default function XapiViewer({ log, mode }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const statements = log.reduce((n, e) => n + e.statements.length, 0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
  }, [open])

  // Every way of closing (Close, Escape, a click outside) ends in close(): the dialog shuts, state
  // follows, and focus goes back to the button. Done here rather than left to the dialog's own close
  // event, which can arrive late or not at all, and some browsers don't focus a clicked button.
  const close = () => {
    if (dialogRef.current?.open) dialogRef.current.close()
    setOpen(false)
    buttonRef.current?.focus()
  }
  useEffect(() => {
    const dialog = dialogRef.current
    const onCancel = (e) => { e.preventDefault(); close() }   // Escape
    const onClose = () => setOpen(false)                      // anything else that shuts it
    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('close', onClose)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('close', onClose)
    }
  }, [])

  // Show the newest first time it opens and as more arrive, unless the reader has scrolled up
  const following = useRef(true)
  useEffect(() => {
    const el = listRef.current
    if (open && el && following.current) el.scrollTop = el.scrollHeight
  }, [log, open])

  return (
    <>
      <button type="button" className="xapi-open" ref={buttonRef} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span aria-hidden="true" className="xapi-braces">{'{ }'}</span> xAPI{' '}
        <span className="xapi-count">{statements}<span className="visually-hidden"> statements sent</span></span>
      </button>

      <dialog ref={dialogRef} className="xapi-dialog" aria-labelledby="xapi-title"
              onClick={(e) => { if (e.target === e.currentTarget) close() }}>
        <div className="xapi-head-bar">
          <h2 id="xapi-title">xAPI statements</h2>
          <button type="button" className="xapi-close" onClick={close}>Close</button>
        </div>
        <p className="xapi-summary">
          {statements} sent to your learning system’s LRS, newest last.
        </p>

        <div className="xapi-list" ref={listRef} tabIndex={0} aria-label="Statements"
             onScroll={(e) => {
               const el = e.currentTarget
               following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8
             }}>
          {log.length === 0 && <p className="xapi-empty">Nothing sent yet. Statements appear here as the quiz is taken.</p>}
          <ol>
            {log.map((entry) => (
              <li key={entry.id} className={`xapi-entry is-${entry.status}`}>
                <p className="xapi-meta">
                  <span className="xapi-time">{time(entry.at)}</span>
                  <span className={`xapi-status is-${entry.status}`}>{STATUS[entry.status]}</span>
                  {entry.error && <span className="xapi-error">{entry.error}</span>}
                </p>
                {entry.statements.length === 0 && entry.status !== 'failed' && (
                  <p className="xapi-line"><span className="xapi-verb">{entry.event}</span> event sent to the server…</p>
                )}
                {entry.statements.map((s) => {
                  const d = describeStatement(s)
                  return (
                    <div key={s.id} className="xapi-statement">
                      <p className="xapi-line">
                        {d.actor} <span className="xapi-verb">{d.verb}</span> <q>{d.object}</q>
                      </p>
                      {d.details.length > 0 && (
                        <dl className="xapi-details">
                          {d.details.map((x) => (
                            <div key={x.label} className={x.tone ? `is-${x.tone}` : undefined}>
                              <dt>{x.label}</dt><dd>{x.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      <details className="xapi-json">
                        <summary>JSON<span className="visually-hidden"> for “{d.verb}”</span></summary>
                        <pre tabIndex={0}>{JSON.stringify(s, null, 2)}</pre>
                      </details>
                    </div>
                  )
                })}
              </li>
            ))}
          </ol>
        </div>
      </dialog>
    </>
  )
}
