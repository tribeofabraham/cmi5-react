import assert from 'node:assert/strict'
import { test } from 'node:test'
import { correctResponse, isValidResponse, quizProblems, responseText, scoreAttempt } from './quiz.js'
import { QUIZZES } from './quizzes/index.js'

const quiz = {
  id: 'q', title: 'Q', passingScore: 0.8,
  questions: [
    { id: 'one', type: 'choice', prompt: '?', explanation: '.', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answer: 'b' },
    { id: 'two', type: 'true-false', prompt: '?', explanation: '.', answer: false },
  ],
}

test('every quiz is well formed', () => {
  for (const q of Object.values(QUIZZES)) assert.deepEqual(quizProblems(q), [], q.id)
})

test('right answers, as xAPI response strings', () => {
  assert.equal(correctResponse(quiz.questions[0]), 'b')
  assert.equal(correctResponse(quiz.questions[1]), 'false')
})

test('only responses a question offers are valid', () => {
  assert.ok(isValidResponse(quiz.questions[0], 'a'))
  assert.ok(!isValidResponse(quiz.questions[0], 'z'))
  assert.ok(isValidResponse(quiz.questions[1], 'true'))
  assert.ok(!isValidResponse(quiz.questions[1], true))   // must be the string
})

test('scoring: unanswered counts as wrong; passing is at or above the mark', () => {
  assert.deepEqual(scoreAttempt(quiz, { one: 'b', two: 'false' }), { raw: 2, min: 0, max: 2, scaled: 1, passed: true })
  assert.deepEqual(scoreAttempt(quiz, { one: 'b' }), { raw: 1, min: 0, max: 2, scaled: 0.5, passed: false })
  assert.equal(scoreAttempt(quiz, {}).raw, 0)
})

test('responses in words, for the review', () => {
  assert.equal(responseText(quiz.questions[0], 'a'), 'A')
  assert.equal(responseText(quiz.questions[1], 'false'), 'False')
})

test('a broken quiz is caught', () => {
  const broken = { ...quiz, questions: [{ ...quiz.questions[0], answer: 'z' }, quiz.questions[0]] }
  const problems = quizProblems(broken)
  assert.ok(problems.some((p) => p.includes('used twice')))
  assert.ok(problems.some((p) => p.includes("isn't one of its choices")))
})
