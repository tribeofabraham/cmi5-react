import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import logo from './assets/LogoOnly.svg'
import { judge } from '../shared/cmi5.js'
import { DEFAULT_QUIZ, QUIZZES } from '../shared/quizzes/index.js'
import { connect, LmsError, readLaunch } from './lms.js'
import { useSizer } from './sizer.js'
import Question from './components/Question.jsx'
import Results from './components/Results.jsx'
import Start from './components/Start.jsx'
import XapiViewer from './components/XapiViewer.jsx'

// The quiz fills the space it's given (an LMS's window or frame). A wide, short space gets the
// landscape layout: two columns and a slim top bar (index.css), sized to a shorter design.
const SIZER = { designWidth: 900, designHeight: 820, fitHeight: true, minScale: 0.8, maxScale: 1.8, reflowBelow: 36 }
const LANDSCAPE_SIZER = { designWidth: 860, designHeight: 470, fitHeight: true, minScale: 0.8, maxScale: 1.8, reflowBelow: 30 }
const LANDSCAPE = '(min-aspect-ratio: 3/2) and (max-height: 600px)'

function useLandscape() {
  const query = useMemo(() => window.matchMedia(LANDSCAPE), [])
  return useSyncExternalStore(
    (onChange) => { query.addEventListener('change', onChange); return () => query.removeEventListener('change', onChange) },
    () => query.matches,
  )
}

// Before (or without) an LMS: an empty log, the same one each time (React needs a stable snapshot)
const EMPTY = []
const NO_LOG = { log: () => EMPTY, subscribe: () => () => {} }

// Launched by a cmi5 LMS: connect, then start → each question → results → Exit (back to the LMS).
// Opened on its own: the same quiz as a practice run, recording nothing.
export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const quiz = QUIZZES[params.get('quiz')] ?? QUIZZES[DEFAULT_QUIZ]
  const showViewer = params.get('xapi-panel') !== '0'

  const [launch, launchError] = useMemo(() => {
    try { return [readLaunch(), ''] } catch (err) { return [null, err.message] }
  }, [])
  const [lms, setLms] = useState(null)
  const [phase, setPhase] = useState(launch ? 'connecting' : launchError ? 'error' : 'start')
  const [problem, setProblem] = useState(launchError)
  const [attempt, setAttempt] = useState(0)

  const [fluid, setFluid] = useState(true)
  const sizerRef = useRef(null)
  const landscape = useLandscape()
  const scale = useSizer(sizerRef, { ...(landscape ? LANDSCAPE_SIZER : SIZER), enabled: fluid })

  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [recordError, setRecordError] = useState('')
  const [finishState, setFinishState] = useState('idle')   // 'idle' | 'saving' | 'saved' | 'failed' | 'practice'
  const timing = useRef({ attempt: 0, question: 0 })

  const source = lms ?? NO_LOG
  const log = useSyncExternalStore(source.subscribe, source.log)

  // Connect to the LMS (again, on Try again)
  useEffect(() => {
    if (!launch || phase !== 'connecting') return undefined
    let live = true
    connect(quiz, launch).then(
      (session) => { if (live) { setLms(session); setPhase(session.info.terminated ? 'ended' : 'start') } },
      (err) => { if (live) { setProblem(err instanceof LmsError ? err.message : 'Something went wrong connecting to your learning system.'); setPhase('error') } },
    )
    return () => { live = false }
  }, [launch, phase, quiz])
  useEffect(() => lms?.terminateOnLeave(), [lms])

  // The quiz as judged here: against the LMS's mastery score when it gave one
  const markedQuiz = useMemo(() => (lms ? { ...quiz, passingScore: judge(quiz, lms.info, {}).mark } : quiz), [quiz, lms])
  const practice = !lms

  const record = (event) => (lms ? lms.record(event) : Promise.resolve([])).catch((err) => {
    setRecordError(err.message)
    throw err
  })

  function start() {
    setResponses({})
    setIndex(0)
    setRecordError('')
    setFinishState('idle')
    setAttempt((n) => n + 1)
    timing.current = { attempt: Date.now(), question: Date.now() }
    setPhase('question')
  }

  function answer(question, response) {
    setResponses((r) => ({ ...r, [question.id]: response }))
    record({ type: 'answered', questionId: question.id, response, durationMs: Date.now() - timing.current.question }).catch(() => {})
  }

  function finish(all = responses) {
    if (practice) { setFinishState('practice'); return }
    setFinishState('saving')
    record({ type: 'finished', responses: all, durationMs: Date.now() - timing.current.attempt })
      .then(() => setFinishState('saved'), () => setFinishState('failed'))
  }

  function next() {
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1)
      timing.current.question = Date.now()
    } else {
      setPhase('results')
      finish()
    }
  }

  async function exit() {
    if (!lms) return
    setPhase('ending')
    try {
      const returnURL = await lms.terminate()
      if (returnURL) { window.location.assign(returnURL); return }
    } catch (err) {
      setRecordError(err.message)
    }
    setPhase('ended')
  }

  return (
    <div className="sizer" ref={sizerRef}>
      <div className="page" style={{ fontSize: `${scale}rem` }}>
        <header className="top">
          {/* Decorative: the name beside it says who this is */}
          <img src={logo} alt="" className="brand-star" width="864" height="864" />
          <p className="brand"><span className="brand-name">Tribe of Abraham</span> <span className="app-name">E-Learning</span></p>
        </header>

        {/* The quiz scrolls here, between a fixed top and bottom, so it works in a window or frame of any size */}
        <main className="main">
          <div className="main-content">
            {phase === 'connecting' && (
              <section className="card notice" aria-labelledby="notice-title">
                <h1 id="notice-title">Connecting to your learning system…</h1>
                <p className="lede" role="status">One moment while the lesson signs you in.</p>
              </section>
            )}
            {phase === 'error' && (
              <section className="card notice" aria-labelledby="notice-title">
                <h1 id="notice-title">The lesson couldn’t start</h1>
                <p className="lede" role="alert">{problem}</p>
                {launch && <button type="button" className="primary" onClick={() => { setProblem(''); setPhase('connecting') }}>Try again</button>}
              </section>
            )}
            {phase === 'start' && <Start quiz={markedQuiz} lms={lms?.info} practice={practice} onStart={start} />}
            {phase === 'question' && (
              <Question key={`${attempt}-${quiz.questions[index].id}`} quiz={quiz} index={index} onAnswer={answer} onNext={next} />
            )}
            {phase === 'results' && (
              <Results quiz={markedQuiz} responses={responses} finishState={finishState}
                       onRetrySave={() => finish()} onRestart={start}
                       onExit={lms ? exit : undefined} />
            )}
            {(phase === 'ending' || phase === 'ended') && (
              <section className="card notice" aria-labelledby="notice-title">
                <h1 id="notice-title" tabIndex={-1}>{phase === 'ending' ? 'Finishing…' : 'You’re done'}</h1>
                <p className="lede" role="status">
                  {phase === 'ending' ? 'Saving your session.' : 'Your session has ended. You can close this window and return to your learning system.'}
                </p>
              </section>
            )}
            {/* Polite: recording problems are worth knowing about, not worth interrupting for */}
            <p className="record-error" role="status">
              {recordError && phase === 'question' ? `Your answers aren't being recorded right now: ${recordError}` : ''}
            </p>
          </div>
        </main>

        <footer className="foot">
          <p>© {new Date().getFullYear()} <a href="https://tribeofabraham.com">Tribe of Abraham</a> · cmi5 e-learning</p>
          <div className="foot-tools">
            {lms && showViewer && <XapiViewer log={log} mode="lms" />}
            {lms && (phase === 'start' || phase === 'question') && (
              <button type="button" className="exit" onClick={exit}>Exit<span className="visually-hidden"> the lesson</span></button>
            )}
            {/* A switch: its name stays "Auto-scale text" and it reports on / off itself */}
            <button type="button" role="switch" aria-checked={fluid} className="scale-switch" onClick={() => setFluid(!fluid)}>
              Auto-scale text
              <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
              <span className="switch-state" aria-hidden="true">{fluid ? 'On' : 'Off'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
