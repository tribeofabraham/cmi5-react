// The quizzes this app can run, by id (?quiz=<id> in the address). Add a quiz by writing a file like
// midi-basics.js and listing it here.
import midiBasics from './midi-basics.js'

export const QUIZZES = { [midiBasics.id]: midiBasics }
export const DEFAULT_QUIZ = midiBasics.id
