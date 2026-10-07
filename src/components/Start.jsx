// The quiz's title and what to expect. Launched by an LMS: who it's recorded for, and what this
// launch mode means. Opened on its own: a practice run, recording nothing.
const MODES = {
  Browse: 'You’re browsing: take the quiz to look around. Your score won’t count.',
  Review: 'You’re reviewing: take the quiz again to look back. Your score won’t change.',
}

function learnerName(actor) {
  return actor?.name || actor?.mbox?.replace(/^mailto:/, '') || actor?.account?.name || 'you'
}

export default function Start({ quiz, lms, practice, onStart }) {
  const count = quiz.questions.length
  const passMark = Math.round(quiz.passingScore * 100)

  return (
    <section className="card start" aria-labelledby="quiz-title">
      <div className="start-intro">
        <p className="eyebrow">Quiz</p>
        <h1 id="quiz-title">{quiz.title}</h1>
        <p className="lede">{quiz.description}</p>
        <ul className="facts">
          <li><strong>{count}</strong> questions</li>
          <li><strong>{passMark}%</strong> to pass</li>
          <li>Feedback after each answer</li>
        </ul>
      </div>

      <div className="start-form">
        {practice ? (
          <p className="who">
            This lesson records your results when your learning system opens it. Opened on its own like this,
            it’s a <strong>practice run</strong>: nothing is recorded.
          </p>
        ) : (
          <>
            <p className="who">Your results go to your learning system for <strong>{learnerName(lms.actor)}</strong>.</p>
            {MODES[lms.launchMode] && <p className="hint">{MODES[lms.launchMode]}</p>}
            {lms.launchMode === 'Normal' && lms.alreadyPassed && (
              <p className="hint">You’ve already passed this lesson. You can take it again for practice; it stays passed.</p>
            )}
          </>
        )}
        <button type="button" className="primary" onClick={onStart}>{practice ? 'Start the practice run' : 'Start the quiz'}</button>
      </div>
    </section>
  )
}
