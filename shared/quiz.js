// Scoring, shared by the page (to give feedback as you go) and the server (which scores again, so a
// score in the LRS can't be made up in the browser).
//
// A quiz: { id, title, description, passingScore (0-1), questions: [question] }
// A question:
//   { id, type: 'choice', prompt, choices: [{ id, text }], answer: choiceId, explanation }
//   { id, type: 'true-false', prompt, answer: true | false, explanation }
// A response is a choice id for 'choice', or 'true' / 'false' for 'true-false' (strings, as xAPI
// records them).

export const QUESTION_TYPES = ['choice', 'true-false']

// The right answer, as an xAPI response string.
export const correctResponse = (question) =>
  question.type === 'true-false' ? String(question.answer) : question.answer

// Whether a response is one this question accepts at all.
export function isValidResponse(question, response) {
  if (typeof response !== 'string') return false
  if (question.type === 'true-false') return response === 'true' || response === 'false'
  return question.choices.some((c) => c.id === response)
}

export const isCorrect = (question, response) => response === correctResponse(question)

// responses: { [questionId]: response }. Unanswered questions count as wrong.
export function scoreAttempt(quiz, responses) {
  const max = quiz.questions.length
  const raw = quiz.questions.filter((q) => isCorrect(q, responses?.[q.id])).length
  const scaled = max ? Math.round((raw / max) * 100) / 100 : 0
  return { raw, min: 0, max, scaled, passed: scaled >= quiz.passingScore }
}

// The words for a response, for the review list: "Note Off", "True".
export function responseText(question, response) {
  if (question.type === 'true-false') return response === 'true' ? 'True' : response === 'false' ? 'False' : ''
  return question.choices.find((c) => c.id === response)?.text ?? ''
}

// Catches mistakes in a quiz file early (run by the tests and when the server starts).
export function quizProblems(quiz) {
  const problems = []
  if (!quiz.id || !quiz.title) problems.push('a quiz needs an id and a title')
  if (!(quiz.passingScore > 0 && quiz.passingScore <= 1)) problems.push('passingScore must be between 0 and 1')
  const ids = new Set()
  for (const q of quiz.questions ?? []) {
    if (ids.has(q.id)) problems.push(`question id ${q.id} is used twice`)
    ids.add(q.id)
    if (!QUESTION_TYPES.includes(q.type)) problems.push(`${q.id}: unknown type ${q.type}`)
    if (!q.prompt || !q.explanation) problems.push(`${q.id}: needs a prompt and an explanation`)
    if (q.type === 'choice' && !q.choices?.some((c) => c.id === q.answer)) problems.push(`${q.id}: its answer isn't one of its choices`)
    if (q.type === 'true-false' && typeof q.answer !== 'boolean') problems.push(`${q.id}: answer must be true or false`)
  }
  if (!ids.size) problems.push('a quiz needs at least one question')
  return problems
}
