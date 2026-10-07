// npm run package: the cmi5 course package for each quiz, to import into an LMS (SCORM Cloud, ...).
//
//   package/<quiz id>/cmi5.xml          the course structure: one course, one AU (the quiz)
//   package/<quiz id>-cmi5.zip          the same, zipped, as most LMSs want it
//
// The AU's url is where the quiz is served (CMI5_URL, default https://learn.tribeofabraham.com/cmi5/);
// the LMS launches it there with its own parameters added. Course and AU ids are permanent: an LMS
// keeps learners' records against them, so don't change them once a course is in use.
import { mkdirSync, writeFileSync } from 'node:fs'
import { QUIZZES } from '../shared/quizzes/index.js'

const BASE = process.env.CMI5_URL ?? 'https://learn.tribeofabraham.com/cmi5/'
const IDS = 'https://tribeofabraham.com/xapi/cmi5-react'

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const text = (s) => `<langstring lang="en-US">${xml(s)}</langstring>`

function courseStructure(quiz) {
  const url = `${BASE}?quiz=${encodeURIComponent(quiz.id)}`
  return `<?xml version="1.0" encoding="utf-8"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="${xml(`${IDS}/courses/${quiz.id}`)}">
    <title>${text(quiz.title)}</title>
    <description>${text(quiz.description)}</description>
  </course>
  <au id="${xml(`${IDS}/aus/${quiz.id}`)}" moveOn="CompletedAndPassed" masteryScore="${quiz.passingScore}" launchMethod="AnyWindow">
    <title>${text(quiz.title)}</title>
    <description>${text(quiz.description)}</description>
    <url>${xml(url)}</url>
  </au>
</courseStructure>
`
}

// A zip with stored (uncompressed) files: enough for a small XML file, and no dependencies.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function zip(files) {
  const parts = []
  const central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content)
    const nameBuf = Buffer.from(name)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12)   // time and date: 1980-01-01, so builds are identical
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28)
    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0, 8); dir.writeUInt16LE(0, 10)
    dir.writeUInt16LE(0, 12); dir.writeUInt16LE(0x21, 14); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24)
    dir.writeUInt16LE(nameBuf.length, 28); dir.writeUInt32LE(offset, 42)
    parts.push(local, nameBuf, data)
    central.push(dir, nameBuf)
    offset += local.length + nameBuf.length + data.length
  }
  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, end])
}

for (const quiz of Object.values(QUIZZES)) {
  const structure = courseStructure(quiz)
  mkdirSync(`package/${quiz.id}`, { recursive: true })
  writeFileSync(`package/${quiz.id}/cmi5.xml`, structure)
  writeFileSync(`package/${quiz.id}-cmi5.zip`, zip({ 'cmi5.xml': structure }))
  console.log(`package/${quiz.id}-cmi5.zip  (AU: ${BASE}?quiz=${quiz.id})`)
}
