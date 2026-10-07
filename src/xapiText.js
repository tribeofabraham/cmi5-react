// An xAPI statement in plain words, for the live panel: who did what to what, and the result.
// Works from the statement alone (not the quiz), so it reads whatever was actually sent.

const LANG = 'en-US'
const text = (map) => map?.[LANG] ?? Object.values(map ?? {})[0] ?? ''

export function actorText(actor) {
  if (!actor) return 'Someone'
  if (actor.name) return actor.name
  if (actor.mbox) return actor.mbox.replace(/^mailto:/, '')
  if (actor.account) return 'The learner'
  return 'Someone'
}

// "PT1M23.4S" -> "1 min 23.4 s"
export function durationText(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const [, h, min, s] = m
  return [h && `${h} h`, min && `${min} min`, s && `${Number(s)} s`].filter(Boolean).join(' ') || '0 s'
}

// A response in words: a choice's description, or True / False.
export function responseText(statement) {
  const response = statement.result?.response
  if (response === undefined) return ''
  const def = statement.object?.definition
  if (def?.interactionType === 'true-false') return response === 'true' ? 'True' : response === 'false' ? 'False' : response
  const choice = def?.choices?.find((c) => c.id === response)
  return choice ? text(choice.description) : response
}

/**
 * { verb, actor, object, details: [{ label, value, tone? }] }
 * tone: 'right' | 'wrong' for values that say how it went.
 */
export function describeStatement(statement) {
  const verb = text(statement.verb?.display) || statement.verb?.id?.split('/').pop() || 'did'
  const object = text(statement.object?.definition?.name) || statement.object?.id || ''
  const result = statement.result ?? {}
  const details = []

  if (result.response !== undefined) details.push({ label: 'Response', value: responseText(statement) })
  if (result.score) {
    const { raw, max, scaled } = result.score
    details.push({ label: 'Score', value: `${raw} of ${max} (${Math.round(scaled * 100)}%)` })
  }
  if (result.success !== undefined) {
    const isAnswer = result.response !== undefined
    details.push({
      label: isAnswer ? 'Correct' : 'Passed',
      value: result.success ? 'Yes' : 'No',
      tone: result.success ? 'right' : 'wrong',
    })
  }
  if (result.completion) details.push({ label: 'Completed', value: 'Yes' })
  if (result.duration) details.push({ label: 'Time', value: durationText(result.duration) })

  return { verb, actor: actorText(statement.actor), object, details }
}
