import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CMI5_CATEGORY, MASTERY_SCORE, MOVEON_CATEGORY, SESSION_ID, isoDuration, judge, passMark, statementsFor } from './cmi5.js'
import midiBasics from './quizzes/midi-basics.js'

let n = 0
const opts = { newId: () => `id-${++n}`, now: '2026-10-07T12:00:00.000Z' }
const session = {
  actor: { objectType: 'Agent', name: 'Ada', account: { homePage: 'https://lms.example.com', name: 'ada' } },
  registration: '11111111-2222-4333-8444-555555555555',
  activityId: 'https://lms.example.com/au/midi',
  launchMode: 'Normal',
  masteryScore: 0.7,
  contextTemplate: {
    contextActivities: { grouping: [{ id: 'https://lms.example.com/course/1', objectType: 'Activity' }] },
    extensions: { [SESSION_ID]: 'session-1' },
  },
}
const allRight = Object.fromEntries(midiBasics.questions.map((q) => [q.id, q.type === 'true-false' ? String(q.answer) : q.answer]))
const sevenRight = Object.fromEntries(Object.entries(allRight).slice(0, 7))
const cats = (s) => (s.context.contextActivities?.category ?? []).map((c) => c.id)

test('durations are ISO 8601', () => {
  assert.equal(isoDuration(83400), 'PT1M23.4S')
  assert.equal(isoDuration(120000), 'PT2M')
})

test('initialized: the AU, the template, the cmi5 category and the session id', () => {
  const [s] = statementsFor(midiBasics, session, { type: 'initialized' }, opts)
  assert.equal(s.verb.id, 'http://adlnet.gov/expapi/verbs/initialized')
  assert.deepEqual(s.object, { objectType: 'Activity', id: session.activityId })
  assert.equal(s.actor, session.actor)
  assert.equal(s.context.registration, session.registration)
  assert.equal(s.context.extensions[SESSION_ID], 'session-1')
  assert.deepEqual(cats(s), [CMI5_CATEGORY])
  assert.equal(s.context.contextActivities.grouping[0].id, 'https://lms.example.com/course/1')
})

test('answered is an allowed statement: the template, no cmi5 category, the AU as parent', () => {
  const [s] = statementsFor(midiBasics, session, { type: 'answered', questionId: 'channels', response: 'c', durationMs: 4000 }, opts)
  assert.equal(s.object.id, `${session.activityId}/questions/channels`)
  assert.deepEqual(cats(s), [])
  assert.equal(s.context.extensions[SESSION_ID], 'session-1')
  assert.equal(s.context.contextActivities.parent[0].id, session.activityId)
  assert.deepEqual(s.result, { response: 'c', success: true, duration: 'PT4S' })
})

test("the LMS's masteryScore is the pass mark", () => {
  assert.equal(passMark(midiBasics, session), 0.7)
  assert.equal(passMark(midiBasics, { ...session, masteryScore: undefined }), midiBasics.passingScore)
  // 7 of 10 passes at the LMS's 0.7, though the quiz's own mark is 0.8
  assert.equal(judge(midiBasics, session, sevenRight).passed, true)
  assert.equal(judge(midiBasics, { ...session, masteryScore: undefined }, sevenRight).passed, false)
})

test('finished: passed with the score and masteryScore, then completed, both moveOn', () => {
  const [passed, completed] = statementsFor(midiBasics, session, { type: 'finished', responses: sevenRight, durationMs: 60000 }, opts)
  assert.equal(passed.verb.id, 'http://adlnet.gov/expapi/verbs/passed')
  assert.deepEqual(passed.result.score, { scaled: 0.7, raw: 7, min: 0, max: 10 })
  assert.equal(passed.result.success, true)
  assert.equal(passed.context.extensions[MASTERY_SCORE], 0.7)
  assert.deepEqual(cats(passed), [CMI5_CATEGORY, MOVEON_CATEGORY])
  assert.equal(completed.verb.id, 'http://adlnet.gov/expapi/verbs/completed')
  assert.deepEqual(completed.result, { completion: true, duration: 'PT1M' })
  assert.deepEqual(cats(completed), [CMI5_CATEGORY, MOVEON_CATEGORY])
})

test('failed below the mark; no masteryscore extension when the LMS gave none', () => {
  const noMastery = { ...session, masteryScore: undefined }
  const [failed] = statementsFor(midiBasics, noMastery, { type: 'finished', responses: sevenRight, durationMs: 1000 }, opts)
  assert.equal(failed.verb.id, 'http://adlnet.gov/expapi/verbs/failed')
  assert.equal(failed.result.success, false)
  assert.equal(failed.context.extensions[MASTERY_SCORE], undefined)
})

test('never passed twice, nor failed after passed, nor completed twice', () => {
  const again = statementsFor(midiBasics, session, { type: 'finished', responses: allRight, durationMs: 1, already: { passed: true, completed: true } }, opts)
  assert.deepEqual(again, [])
  const afterFail = statementsFor(midiBasics, session, { type: 'finished', responses: allRight, durationMs: 1, already: { passed: false, completed: true } }, opts)
  assert.deepEqual(afterFail.map((s) => s.verb.display['en-US']), ['passed'])
})

test('nothing judged outside Normal mode', () => {
  for (const launchMode of ['Browse', 'Review']) {
    assert.deepEqual(statementsFor(midiBasics, { ...session, launchMode }, { type: 'finished', responses: allRight, durationMs: 1 }, opts), [])
  }
})

test('terminated: the session time, the cmi5 category', () => {
  const [s] = statementsFor(midiBasics, session, { type: 'terminated', durationMs: 90000 }, opts)
  assert.equal(s.verb.id, 'http://adlnet.gov/expapi/verbs/terminated')
  assert.equal(s.result.duration, 'PT1M30S')
  assert.deepEqual(cats(s), [CMI5_CATEGORY])
})

test("the LMS's template is never changed by a statement", () => {
  statementsFor(midiBasics, session, { type: 'finished', responses: allRight, durationMs: 1 }, opts)
  assert.equal(session.contextTemplate.contextActivities.category, undefined)
  assert.equal(session.contextTemplate.extensions[MASTERY_SCORE], undefined)
})
