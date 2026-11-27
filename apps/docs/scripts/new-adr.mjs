import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const title = process.argv.slice(2).join(' ').trim()
if (!title) {
  console.error('Usage: pnpm docs:new-adr "Decision title"')
  process.exit(1)
}
const dir = fileURLToPath(new URL('../src/adr/', import.meta.url))
const last = readdirSync(dir)
  .map((f) => /^(\d{4})-/.exec(f)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b)
  .pop() ?? 0
const num = String(last + 1).padStart(4, '0')
const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const tpl = readFileSync(fileURLToPath(new URL('../templates/adr.md', import.meta.url)), 'utf8')
const out = tpl
  .replaceAll('__NUM__', num)
  .replaceAll('__TITLE__', title)
  .replaceAll('__DATE__', new Date().toISOString().slice(0, 10))
const file = `${dir}${num}-${slug}.md`
writeFileSync(file, out, { flag: 'wx' })
console.log(`Created ${file}`)
