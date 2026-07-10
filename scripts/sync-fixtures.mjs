// Copies src/fixtures/*.json to public/api/ so the deployed site serves the
// same data the app imports — machine-readable, agent-fetchable, one source.
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'src', 'fixtures')
const dest = join(root, 'public', 'api')

mkdirSync(dest, { recursive: true })
const files = readdirSync(src).filter((f) => f.endsWith('.json'))
for (const f of files) cpSync(join(src, f), join(dest, f))

writeFileSync(
  join(dest, 'index.json'),
  JSON.stringify(
    {
      name: 'open-date',
      description:
        'Machine-readable fixtures for the Open Date progressive fit filtering engine. All data is synthetic.',
      contract: '/open-date/api/contract.json',
      files: files.map((f) => `/open-date/api/${f}`),
    },
    null,
    2,
  ) + '\n',
)

console.log(`synced ${files.length} fixture(s) -> public/api/`)
