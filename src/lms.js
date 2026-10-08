// Talking to the LMS that launched the quiz, the cmi5 way.
//
// The LMS opens the quiz with five things in its address:
//   endpoint      its LRS                         actor         the learner (an xAPI agent)
//   fetch         where to get the login token    registration  this learner's enrolment
//   activityId    this quiz (the AU) as the LMS knows it
// The quiz then:
//   1. POSTs to fetch once for an auth token (kept in sessionStorage, as the fetch address only
//      works once and a reload must still work)
//   2. reads the LMS.LaunchData state document: launchMode, masteryScore, moveOn, returnURL and the
//      context template (with this session's id)
//   3. reads the learner's preferences (the cmi5LearnerPreferences agent profile), as cmi5 requires
//      before any statement
//   4. reads its own progress for the registration (has it passed / completed before?) from a state
//      document of its own, so it never sends those twice
//   5. sends statements (shared/cmi5.js) and, when done, terminated, then goes back to returnURL.
import { LAUNCH_DATA, SESSION_ID, XAPI_VERSION, statementsFor } from '../shared/cmi5.js'

const PROGRESS = 'https://tribeofabraham.com/xapi/cmi5-react/state/progress'
const PARAMS = ['endpoint', 'fetch', 'actor', 'registration', 'activityId']

export class LmsError extends Error {}

// The launch, from the address: the five parameters, or null when the quiz was opened on its own.
export function readLaunch(search = window.location.search) {
  const params = new URLSearchParams(search)
  if (!PARAMS.every((p) => params.get(p))) return null
  let actor
  try { actor = JSON.parse(params.get('actor')) } catch { throw new LmsError('The learner (actor) in the launch address is not valid.') }
  const endpoint = params.get('endpoint')
  return {
    endpoint: endpoint.endsWith('/') ? endpoint : `${endpoint}/`,
    fetchUrl: params.get('fetch'),
    actor,
    registration: params.get('registration'),
    activityId: params.get('activityId'),
  }
}

const keep = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)) } catch { return null } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* reload loses it */ } },
}

// Connects to the LMS and returns the session: { info, record(event), terminate(), log(), subscribe() }.
export async function connect(quiz, launch) {
  const key = `cmi5:${launch.registration}:${launch.fetchUrl}`
  const saved = keep.get(key) ?? {}

  // 1. The token, once
  let token = saved.token
  if (!token) {
    let res
    try { res = await fetch(launch.fetchUrl, { method: 'POST' }) } catch { throw new LmsError('Could not reach your learning system to sign in.') }
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.['auth-token']) {
      throw new LmsError(body?.['error-text'] || `Your learning system refused the sign-in (${res.status}). Launch the lesson again from your learning system.`)
    }
    token = body['auth-token']
  }
  const headers = { Authorization: `Basic ${token}`, 'X-Experience-API-Version': XAPI_VERSION }

  async function lrs(method, path, { query, body } = {}) {
    const url = new URL(path, launch.endpoint)
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
    let res
    try {
      res = await fetch(url, { method, headers: { ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined, keepalive: method !== 'GET' })
    } catch { throw new LmsError('Could not reach your learning system.') }
    if (res.status === 404 && method === 'GET') return null
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200)
      throw new LmsError(`Your learning system answered ${res.status}${detail ? `: ${detail}` : ''}.`)
    }
    return method === 'GET' ? res.json() : null
  }
  const stateQuery = (stateId) => ({ stateId, activityId: launch.activityId, agent: JSON.stringify(launch.actor), registration: launch.registration })

  // 2. The LMS's launch data
  const launchData = await lrs('GET', 'activities/state', { query: stateQuery(LAUNCH_DATA) })
  if (!launchData?.contextTemplate) throw new LmsError('Your learning system did not give this lesson its launch data.')
  // 3. The learner's preferences (language, audio): cmi5 has the AU read them before it sends
  //    anything, and strict LMSs (SCORM Cloud) refuse statements until it has. None set is a 404.
  const preferences = (await lrs('GET', 'agents/profile', {
    query: { profileId: 'cmi5LearnerPreferences', agent: JSON.stringify(launch.actor) },
  })) ?? {}
  // 4. What this registration has already recorded
  const progress = (await lrs('GET', 'activities/state', { query: stateQuery(PROGRESS) }).catch(() => null)) ?? {}

  const session = {
    actor: launch.actor,
    registration: launch.registration,
    activityId: launch.activityId,
    contextTemplate: launchData.contextTemplate,
    launchMode: launchData.launchMode ?? 'Normal',
    masteryScore: typeof launchData.masteryScore === 'number' ? launchData.masteryScore : undefined,
    moveOn: launchData.moveOn,
    returnURL: launchData.returnURL,
  }
  const sessionId = session.contextTemplate.extensions?.[SESSION_ID] ?? ''
  // This session's own memory (survives a reload): when it started, what it has sent
  const mine = { token, started: Date.now(), initialized: false, terminated: false, ...(saved.sessionId === sessionId ? saved : {}), sessionId }
  const save = () => keep.set(key, mine)
  save()

  // A live log of what's sent, for the xAPI viewer
  let log = []
  let nextId = 1
  const listeners = new Set()
  const changed = () => listeners.forEach((fn) => fn())
  const upsert = (id, change) => { log = log.map((e) => (e.id === id ? { ...e, ...change } : e)); changed() }

  async function send(event) {
    const statements = statementsFor(quiz, session, event, { newId: () => crypto.randomUUID(), now: new Date().toISOString() })
    if (!statements.length) return []
    const id = nextId++
    log = [...log, { id, event: event.type, status: 'sending', statements, error: '', at: Date.now() }]
    changed()
    try {
      await lrs('POST', 'statements', { body: statements })
      upsert(id, { status: 'stored' })
      return statements
    } catch (err) {
      upsert(id, { status: 'failed', error: err.message })
      throw err
    }
  }

  // initialized first, once per session
  if (!mine.initialized) {
    await send({ type: 'initialized' })
    mine.initialized = true
    save()
  }

  return {
    info: {
      ...session,
      alreadyPassed: !!progress.passed, alreadyCompleted: !!progress.completed, terminated: mine.terminated,
      languagePreference: preferences.languagePreference ?? '', audioPreference: preferences.audioPreference ?? '',
    },

    // answered / finished (finished turns into passed or failed, and completed, as the rules allow)
    async record(event) {
      if (mine.terminated) throw new LmsError('This session has ended. Launch the lesson again to continue.')
      if (event.type !== 'finished') return send(event)
      const sent = await send({ ...event, already: { passed: !!progress.passed, completed: !!progress.completed } })
      for (const s of sent) {
        if (s.verb.display['en-US'] === 'passed') progress.passed = true
        if (s.verb.display['en-US'] === 'completed') progress.completed = true
      }
      if (sent.length) await lrs('PUT', 'activities/state', { query: stateQuery(PROGRESS), body: progress }).catch(() => {})
      return sent
    },

    // terminated, last and once; then the LMS's return address, if it gave one
    async terminate() {
      if (mine.terminated) return session.returnURL
      await send({ type: 'terminated', durationMs: Date.now() - mine.started })
      mine.terminated = true
      save()
      return session.returnURL
    },

    // If the window closes (or reloads: a page can't tell which) without Exit, still send terminated;
    // keepalive lets it outlive the page. The session is marked ended first, synchronously, so a
    // reloaded page knows and doesn't send anything more in it.
    terminateOnLeave() {
      const leave = () => {
        if (mine.terminated || !mine.initialized) return
        mine.terminated = true
        save()
        send({ type: 'terminated', durationMs: Date.now() - mine.started }).catch(() => {})
      }
      window.addEventListener('pagehide', leave)
      return () => window.removeEventListener('pagehide', leave)
    },

    log: () => log,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  }
}
