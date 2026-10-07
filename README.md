# cmi5-react

The **MIDI Basics** quiz as a **cmi5** lesson: an Assignable Unit (AU) that a learning system (LMS)
imports and launches, and that records the attempt in the LMS's own LRS with xAPI, to the cmi5
rules. Built in React, in the Tribe of Abraham look. It's the cmi5 sibling of
[elearning-react](https://github.com/tribeofabraham/elearning-react), with the same quiz, screens
and accessibility (WCAG 2.2 AA: keyboard and screen reader friendly, colour contrast held by a test,
sized by a sizer with an Auto-scale switch, a landscape layout for short frames; axe: no
violations).

Live at **https://learn.tribeofabraham.com/cmi5/**. It's only files: the quiz talks to the LMS
itself, so there's no server of its own.

## Using it in an LMS (SCORM Cloud, …)

1. `npm run package` makes `package/midi-basics-cmi5.zip` (just `cmi5.xml`: one course, one AU).
2. Import the zip into the LMS as a cmi5 course. The AU points at the live address; the LMS adds its
   launch parameters.
3. Launch it from the LMS.

Course and AU ids (`https://tribeofabraham.com/xapi/cmi5-react/courses|aus/midi-basics`) are
permanent: the LMS keeps learners' records against them. The AU's `masteryScore` is 0.8 and
`moveOn` is `CompletedAndPassed`; an LMS may change both.

Opened on its own (no launch parameters), it's a practice run that records nothing.

## What it does, by the spec

**Launch.** The LMS opens it with `endpoint`, `fetch`, `actor`, `registration` and `activityId`.
The quiz:

1. POSTs to `fetch` once for its auth token (kept for the session, so a reload works).
2. Reads the `LMS.LaunchData` state document: `launchMode`, `masteryScore`, `moveOn`,
   `returnURL` and the `contextTemplate` (with the session id).
3. Reads its own progress document for the registration, so it never repeats what's recorded.

**Statements**, every one with the launch actor, the registration and the LMS's context template:

| When | Statement | Notes |
| --- | --- | --- |
| Connected | `initialized` | First, once per session; cmi5 category |
| Each answer | `answered` | An "allowed" statement: the question as a `cmi.interaction`, the AU as parent; no cmi5 category |
| Finished (Normal mode) | `passed` or `failed` | Against the LMS's `masteryScore` (else the quiz's 0.8); score raw/min/max/scaled, the `masteryscore` extension; cmi5 and moveOn categories |
| Finished (Normal mode) | `completed` | cmi5 and moveOn categories |
| Exit, or the window closing | `terminated` | Last, once; the session's time; then back to `returnURL` |

Rules kept: never `passed` twice in a registration, nor `failed` after `passed`, nor `completed`
twice; nothing judged in Browse or Review mode; nothing after `terminated` (a reload after the
window sent `terminated` shows "You're done").

A small **"{ } xAPI"** button in the footer opens a dialog listing each statement in plain words as
it's sent (`?xapi-panel=0` hides it).

## Project layout

| Path | What it is |
| --- | --- |
| `shared/quizzes/` | The quizzes (the same format as elearning-react's) |
| `shared/quiz.js` | Scoring |
| `shared/cmi5.js` | The cmi5 statements and their rules |
| `src/lms.js` | The launch, the token, launch data, sending, terminating |
| `src/App.jsx`, `src/components/` | The screens |
| `scripts/package.mjs` | `npm run package`: cmi5.xml and the zip |
| `deploy/` | `npm run setup` (once) and `npm run deploy` |

## Working on it

```
npm install
npm run dev       # the practice run, at the address Vite prints
npm test          # the cmi5 rules, scoring, statements in words, colour contrast
npm run build     # dist/
npm run package   # package/<quiz>-cmi5.zip
```

To try a real launch, import the package into SCORM Cloud (its cmi5 support is the reference most
LMSs follow).

## Deploying

The files are served by Caddy on the Ragamuffin Studios VPS (`50.6.206.202`) at
`/cmi5/` of learn.tribeofabraham.com, beside elearning-react.

- **Once:** `npm run setup` (from Git Bash, with the SSH key that logs in as root): the folder, and
  the `/cmi5/` route in Caddy (checked before Caddy reloads; put back if not accepted).
- **Each time** (after committing and pushing): `npm run deploy`. It refuses unless this copy
  matches GitHub, runs the tests, builds, and swaps the new files in at once.

## License

MIT
