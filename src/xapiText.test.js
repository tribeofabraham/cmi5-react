import assert from 'node:assert/strict'
import { test } from 'node:test'
import midiBasics from '../shared/quizzes/midi-basics.js'
import { statementsFor } from '../shared/cmi5.js'
import { actorText, describeStatement, durationText } from './xapiText.js'

const session = {
  actor: { objectType: 'Agent', name: 'Ada', account: { homePage: 'https://lms.example.com', name: 'ada' } },
  registration: '11111111-2222-4333-8444-555555555555',
  activityId: 'https://lms.example.com/au/midi',
  launchMode: 'Normal',
  contextTemplate: {},
}
const opts = { newId: () => 'id', now: '2026-10-07T12:00:00.000Z' }

test('durations in words', () => {
  assert.equal(durationText('PT4.2S'), '4.2 s')
  assert.equal(durationText('PT1M23.4S'), '1 min 23.4 s')
})

test('learners by name, then email, else their account', () => {
  assert.equal(actorText({ name: 'Ada', mbox: 'mailto:a@x.com' }), 'Ada')
  assert.equal(actorText({ mbox: 'mailto:a@x.com' }), 'a@x.com')
})

test('an answer: the question, the response in words, right or wrong, the time', () => {
  const [s] = statementsFor(midiBasics, session, { type: 'answered', questionId: 'sustain', response: 'a', durationMs: 4200 }, opts)
  assert.deepEqual(describeStatement(s).details, [
    { label: 'Response', value: 'Volume' },
    { label: 'Correct', value: 'No', tone: 'wrong' },
    { label: 'Time', value: '4.2 s' },
  ])
})

test('terminated reads as the session time', () => {
  const [s] = statementsFor(midiBasics, session, { type: 'terminated', durationMs: 90000 }, opts)
  const d = describeStatement(s)
  assert.equal(d.verb, 'terminated')
  assert.deepEqual(d.details, [{ label: 'Time', value: '1 min 30 s' }])
})
