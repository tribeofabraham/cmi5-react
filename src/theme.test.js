// npm test: the colours meet WCAG AA. Text 4.5:1; the edges of controls 3:1.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const token = (name) => css.match(new RegExp(String.raw`--${name}:\s*(#[0-9a-f]{6})`, 'i'))[1]
const [BG, SURFACE, RAISED, PANEL, EDGE, PAPER, CREAM, MUTED, BRASS, BRASS_LIGHT, RIGHT, WRONG] =
  ['bg', 'surface', 'raised', 'panel', 'edge', 'paper', 'cream', 'muted', 'brass', 'brass-light', 'right', 'wrong'].map(token)

const check = (fg, bg, min) => assert.ok(contrast(fg, bg) >= min, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)} < ${min}`)

test('text reads at 4.5:1 on the page, the card, a picked answer and the xAPI panel', () => {
  for (const fg of [PAPER, CREAM, MUTED, BRASS_LIGHT, RIGHT, WRONG]) for (const bg of [BG, SURFACE, RAISED, PANEL]) check(fg, bg, 4.5)
})

test('black on the brass buttons, normal and hovered', () => {
  check('#000000', BRASS, 4.5)
  check('#000000', BRASS_LIGHT, 4.5)
})

test('the edges of controls show at 3:1', () => {
  for (const edge of [EDGE, BRASS, BRASS_LIGHT, RIGHT, WRONG]) for (const bg of [BG, SURFACE, RAISED, PANEL]) check(edge, bg, 3)
})

test('the Auto-scale switch: the knob shows on its track, on and off', () => {
  check(MUTED, BG, 3)          // off: grey knob on the black track
  check('#000000', BRASS, 3)   // on: black knob on the brass track
  check(BRASS, BG, 3)          // the brass track itself, against the page
})
