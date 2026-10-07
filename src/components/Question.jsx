import { useEffect, useRef, useState } from 'react'
import { correctResponse, isCorrect } from '../../shared/quiz.js'

// One question: pick an answer, check it, read why, go on. Focus moves to the question when it
// appears and to the feedback once checked, so a screen reader reads each in turn.
// The parts are siblings in one form, so a wide, short frame can lay them out in two columns
// (index.css, "Landscape") without changing their order for screen readers or the keyboard.
export default function Question({ quiz, index, onAnswer, onNext }) {
  const question = quiz.questions[index]
  const total = quiz.questions.length
  const last = index + 1 === total
  const options = question.type === 'true-false'
    ? [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]
    : question.choices

  const [choice, setChoice] = useState(null)
  const [checked, setChecked] = useState(false)
  const [nudge, setNudge] = useState('')
  const headingRef = useRef(null)
  const feedbackRef = useRef(null)
  const right = correctResponse(question)
  const correct = checked && isCorrect(question, choice)
  const promptId = `q-${question.id}`

  useEffect(() => { headingRef.current?.focus() }, [])
  useEffect(() => { if (checked) feedbackRef.current?.focus() }, [checked])

  function check(e) {
    e.preventDefault()
    if (checked) return onNext()
    if (!choice) {
      setNudge('Choose an answer first.')
      return
    }
    setChecked(true)
    onAnswer(question, choice, isCorrect(question, choice))
  }

  return (
    <section className="card question" aria-labelledby={promptId}>
      <form className="question-form" onSubmit={check} noValidate>
        <div className="progress">
          <p>Question {index + 1} of {total}</p>
          {/* The words above say the same; this is the picture of it */}
          <div className="progress-bar" aria-hidden="true"><span style={{ width: `${((index + (checked ? 1 : 0)) / total) * 100}%` }} /></div>
        </div>

        <h1 id={promptId} className="prompt" ref={headingRef} tabIndex={-1}>{question.prompt}</h1>

        {/* A native radio group, named by the question: Tab reaches it once, the arrow keys choose */}
        <div className={`choices${checked ? ' is-locked' : ''}`} role="radiogroup" aria-labelledby={promptId}
             aria-describedby={nudge ? 'nudge' : undefined}>
          {options.map((o) => {
            const mark = checked && (o.id === right ? 'right' : o.id === choice ? 'wrong' : null)
            return (
              <label key={o.id} className={`choice${choice === o.id ? ' chosen' : ''}${mark ? ` ${mark}` : ''}`}>
                <input type="radio" name={question.id} value={o.id} checked={choice === o.id} disabled={checked}
                       onChange={() => { setChoice(o.id); setNudge('') }} />
                <span className="choice-text">{o.text}</span>
                {/* Said in words, not only shown in colour */}
                {mark === 'right' && <span className="choice-mark">{o.id === choice ? '✓ Your answer is right' : '✓ Right answer'}</span>}
                {mark === 'wrong' && <span className="choice-mark">✗ Your answer</span>}
              </label>
            )
          })}
        </div>
        {nudge && <p className="field-error nudge" id="nudge" role="alert">{nudge}</p>}

        {checked && (
          <div className={`feedback ${correct ? 'is-right' : 'is-wrong'}`} ref={feedbackRef} tabIndex={-1}>
            <h2>{correct ? 'Right!' : 'Not quite.'}</h2>
            <p>{question.explanation}</p>
          </div>
        )}

        <button type="submit" className="primary next">
          {!checked ? 'Check answer' : last ? 'See your results' : 'Next question'}
        </button>
      </form>
    </section>
  )
}
