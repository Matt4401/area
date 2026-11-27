import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Adr {
  number: string
  title: string
  status: string
  date: string
  url: string
  supersedes: string
  supersededBy: string
}

const adrDir = fileURLToPath(new URL('../src/adr/', import.meta.url))

function field(front: string, key: string): string {
  const m = front.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

/** Reads every `NNNN-*.md` ADR from src/adr: single source for the sidebar and the index page. */
export function readAdrs(): Adr[] {
  return readdirSync(adrDir)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort()
    .map((file) => {
      const src = readFileSync(join(adrDir, file), 'utf8')
      const front = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
      const h1 = src.match(/^# (.+)$/m)?.[1] ?? file
      const number = file.slice(0, 4)
      return {
        number,
        title: h1.replace(/^ADR-\d+:\s*/, ''),
        status: field(front, 'status'),
        date: field(front, 'date'),
        supersedes: field(front, 'supersedes'),
        supersededBy: field(front, 'superseded-by'),
        url: `/adr/${file.replace(/\.md$/, '')}`,
      }
    })
}
