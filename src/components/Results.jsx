import { useEffect, useRef } from 'react'
import { correctResponse, isCorrect, responseText, scoreAttempt } from '../../shared/quiz.js'

// The score, whether it passed, and every question with the learner's answer. (What was recorded is in
// the xAPI viewer.) The summary and the review are side by side in a wide, short frame.
export default function Results({ quiz, responses, finishState, onRetrySave, onRestart, onExit }) {
  const { raw, max, scaled, passed } = scoreAttempt(quiz, responses)
  const percent = Math.round(scaled * 100)
  const passMark = Math.round(quiz.passingScore * 100)
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])

  return (
    <section className="card results" aria-labelledby="results-title">
      <div className="results-summary">
        <p className="eyebrow">{quiz.title}</p>
        <h1 id="results-title" ref={headingRef} tabIndex={-1}>
          You scored {raw} of {max} <span className="percent">({percent}%)</span>
        </h1>
        <p className={`verdict ${passed ? 'is-right' : 'is-wrong'}`}>
          {passed ? `Passed. The pass mark is ${passMark}%.` : `Not passed yet. The pass mark is ${passMark}%.`}
        </p>

        <p className="saved" role="status">
          {finishState === 'saving' && 'Recording your score…'}
          {finishState === 'saved' && 'Your score has been recorded.'}
          {finishState === 'failed' && 'Your score could not be recorded.'}
          {finishState === 'practice' && 'A practice run: nothing was recorded.'}
        </p>
        {finishState === 'failed' && <button type="button" className="secondary" onClick={onRetrySave}>Try recording again</button>}

        <div className="actions">
          {/* Launched by an LMS, finishing goes back to it (cmi5: terminated, then its return address) */}
          {onExit && <button type="button" className="primary" onClick={onExit}>Finish and return</button>}
          <button type="button" className={onExit ? 'secondary' : 'primary'} onClick={onRestart}>Take it again</button>
        </div>
      </div>

      <div className="results-review">
        <h2 className="review-title" id="review-heading">Your answers</h2>
        {/* Focusable so it can be scrolled from the keyboard when it scrolls on its own (landscape) */}
        <ol className="review" tabIndex={0} aria-labelledby="review-heading">
          {quiz.questions.map((q) => {
            const ok = isCorrect(q, responses[q.id])
            return (
              <li key={q.id} className={ok ? 'is-right' : 'is-wrong'}>
                <p className="review-q">{q.prompt}</p>
                <p className="review-a">
                  <span className="review-mark">{ok ? '✓ Right' : '✗ Wrong'}:</span>{' '}
                  {responseText(q, responses[q.id]) || 'not answered'}
                  {!ok && <> <span className="review-right">(answer: {responseText(q, correctResponse(q))})</span></>}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
