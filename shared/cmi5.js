// The xAPI statements a cmi5 Assignable Unit (AU) sends, to the cmi5 spec
// (https://github.com/AICC/CMI-5_Spec_Current, "cmi5 defined statements").
//
// A session, as the LMS launched it:
//   { actor, registration, activityId,          from the launch address
//     contextTemplate, launchMode, masteryScore, from the LMS's LMS.LaunchData state document
//     moveOn, returnURL }
//
// In a session the AU sends, in this order:
//   initialized                    first, once
//   answered (per question)        "allowed" statements: the context template, no cmi5 category
//   passed or failed, completed    "cmi5 defined": only in Normal mode, judged against the LMS's
//                                   masteryScore, with the cmi5 and moveOn categories
//   terminated                     last, once
//
// Rules kept here: an AU never sends passed twice in a registration, nor failed after passed, nor
// completed twice; nothing judged outside Normal mode.

import { correctResponse, isCorrect, scoreAttempt } from './quiz.js'

export const XAPI_VERSION = '1.0.3'
const LANG = 'en-US'

export const CMI5_CATEGORY = 'https://w3id.org/xapi/cmi5/context/categories/cmi5'
export const MOVEON_CATEGORY = 'https://w3id.org/xapi/cmi5/context/categories/moveon'
export const SESSION_ID = 'https://w3id.org/xapi/cmi5/context/extensions/sessionid'
export const MASTERY_SCORE = 'https://w3id.org/xapi/cmi5/context/extensions/masteryscore'
export const LAUNCH_DATA = 'LMS.LaunchData'

export const VERBS = Object.fromEntries(
  ['initialized', 'answered', 'passed', 'failed', 'completed', 'terminated'].map((v) => [
    v,
    { id: `http://adlnet.gov/expapi/verbs/${v}`, display: { [LANG]: v } },
  ]),
)

// Milliseconds as an ISO 8601 duration, as xAPI wants: 83400 -> "PT1M23.4S".
export function isoDuration(ms) {
  const tenths = Math.max(0, Math.round(ms / 100))
  const h = Math.floor(tenths / 36000)
  const m = Math.floor((tenths % 36000) / 600)
  const s = (tenths % 600) / 10
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || !(h || m) ? `${s}S` : ''}`
}

// The mark to pass: the LMS's masteryScore when it gave one (cmi5 requires the AU to use it), else
// the quiz's own.
export const passMark = (quiz, session) =>
  typeof session.masteryScore === 'number' ? session.masteryScore : quiz.passingScore

// The context every statement in the session carries: the LMS's template (its context activities
// and extensions, including the session id), the registration, and for cmi5-defined statements the
// cmi5 category (and moveOn for passed / failed / completed).
export function contextFor(session, { cmi5 = false, moveOn = false, parent = false } = {}) {
  const template = session.contextTemplate ?? {}
  const contextActivities = JSON.parse(JSON.stringify(template.contextActivities ?? {}))
  if (cmi5) {
    const category = [...(contextActivities.category ?? []), { id: CMI5_CATEGORY, objectType: 'Activity' }]
    if (moveOn) category.push({ id: MOVEON_CATEGORY, objectType: 'Activity' })
    contextActivities.category = category
  }
  if (parent) contextActivities.parent = [...(contextActivities.parent ?? []), { id: session.activityId, objectType: 'Activity' }]
  const context = { registration: session.registration, language: LANG, extensions: { ...(template.extensions ?? {}) } }
  if (Object.keys(contextActivities).length) context.contextActivities = contextActivities
  return context
}

const auObject = (session) => ({ objectType: 'Activity', id: session.activityId })

// A question as an xAPI interaction, under the AU, with its choices and right answer.
export function questionActivity(question, session) {
  const definition = {
    type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    name: { [LANG]: question.prompt },
    interactionType: question.type,
    correctResponsesPattern: [correctResponse(question)],
  }
  if (question.type === 'choice') {
    definition.choices = question.choices.map((c) => ({ id: c.id, description: { [LANG]: c.text } }))
  }
  return { objectType: 'Activity', id: `${session.activityId}/questions/${question.id}`, definition }
}

/**
 * The statements for one event in a session.
 *
 * events:
 *   { type: 'initialized' }
 *   { type: 'answered', questionId, response, durationMs }
 *   { type: 'finished', responses, durationMs, already: { passed, completed } }
 *        -> passed or failed (unless passed already), completed (unless completed already);
 *           nothing outside Normal mode
 *   { type: 'terminated', durationMs }   (the whole session's time)
 * opts: { newId, now }
 */
export function statementsFor(quiz, session, event, { newId, now }) {
  const base = (verb, object, context, result) => ({
    id: newId(), timestamp: now, actor: session.actor, verb: VERBS[verb], object, context, ...(result ? { result } : {}),
  })

  if (event.type === 'initialized') return [base('initialized', auObject(session), contextFor(session, { cmi5: true }))]

  if (event.type === 'answered') {
    const question = quiz.questions.find((q) => q.id === event.questionId)
    return [base('answered', questionActivity(question, session), contextFor(session, { parent: true }), {
      response: event.response,
      success: isCorrect(question, event.response),
      duration: isoDuration(event.durationMs),
    })]
  }

  if (event.type === 'finished') {
    if (session.launchMode !== 'Normal') return []
    const mark = passMark(quiz, session)
    const { raw, min, max, scaled } = scoreAttempt(quiz, event.responses)
    const passed = scaled >= mark
    const duration = isoDuration(event.durationMs)
    const out = []
    if (!event.already?.passed) {
      const context = contextFor(session, { cmi5: true, moveOn: true })
      if (typeof session.masteryScore === 'number') context.extensions[MASTERY_SCORE] = session.masteryScore
      out.push(base(passed ? 'passed' : 'failed', auObject(session), context, {
        score: { scaled, raw, min, max }, success: passed, duration,
      }))
    }
    if (!event.already?.completed) {
      out.push(base('completed', auObject(session), contextFor(session, { cmi5: true, moveOn: true }), { completion: true, duration }))
    }
    return out
  }

  if (event.type === 'terminated') {
    return [base('terminated', auObject(session), contextFor(session, { cmi5: true }), { duration: isoDuration(event.durationMs) })]
  }

  throw new Error(`Unknown event type: ${event.type}`)
}

// What the attempt counts as, for the screen: passed against the LMS's mark.
export function judge(quiz, session, responses) {
  const mark = passMark(quiz, session)
  const score = scoreAttempt(quiz, responses)
  return { ...score, passed: score.scaled >= mark, mark }
}
