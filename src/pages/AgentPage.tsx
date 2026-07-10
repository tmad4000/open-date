import { useMemo, useState } from 'react'
import contract from '../fixtures/contract.json'
import { fixtures, useStore } from '../state/store'

const API_FILES = [
  'index.json',
  'contract.json',
  'dating.profiles.json',
  'dating.facets.json',
  'dating.reasons.json',
  'dating.archetypes.json',
  'scholarships.json',
  'scholarship.facts.json',
  'scholarship.archetypes.json',
]

export default function AgentPage() {
  const store = useStore()
  const { state, datingModel, factSheet } = store
  const [copied, setCopied] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const exportBlob = useMemo(
    () =>
      JSON.stringify(
        {
          ...state,
          derived: {
            note: 'Derived views — rebuild them by replaying the journals against the fixtures.',
            datingModel,
            factSheet,
          },
        },
        null,
        2,
      ),
    [state, datingModel, factSheet],
  )

  const agentBrief = useMemo(() => {
    const liked = state.dating.events.filter((e) => e.verdict === 'like')
    const passed = state.dating.events.filter((e) => e.verdict === 'pass')
    const name = (id: string) =>
      fixtures.profiles.find((p) => p.id === id)?.name ?? id
    return [
      `# Open Date — agent brief (v${__APP_VERSION__})`,
      '',
      'You are looking at an exported progressive-fit-filtering session.',
      '',
      '## Dating',
      `- archetypes: ${state.dating.archetypeIds.join(', ') || '(none)'}`,
      `- journal: ${state.dating.events.length} events (${liked.length} like / ${passed.length} pass)`,
      `- liked: ${liked.map((e) => name(e.candidateId)).join('; ') || '(none)'}`,
      `- dealbreakers: ${datingModel.vetoes.join(', ') || '(none)'}`,
      `- top weights: ${Object.entries(datingModel.weights)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 6)
        .map(([k, w]) => `${k}=${w}`)
        .join(', ') || '(none)'}`,
      '',
      '## Scholarships',
      `- archetypes: ${state.scholarships.archetypeIds.join(', ') || '(none)'}`,
      `- fact answers: ${Object.entries(factSheet)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || '(none)'}`,
      '',
      '## What you can do',
      '- Re-rank: replay the journal against fixtures (see contract.json → paradigm.loop).',
      '- Explain: use ScoreResult.contributions / FitResult.rows only — never invent reasons.',
      '- Clarify: FitResult.wouldFitIf lists the exact open questions worth asking.',
      '- Extend: propose new facets/reasons as fixture edits; the traitKey vocabulary is open.',
    ].join('\n')
  }, [state, datingModel, factSheet])

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1600)
  }

  return (
    <div>
      <h1>Agent surface</h1>
      <p className="lede">
        Everything an agent needs to participate: fixtures served as static JSON, a data
        contract, and the full session state — exportable, importable, and replayable.
      </p>

      <h2 style={{ marginTop: '1.6rem' }}>Machine-readable data</h2>
      <p className="small muted">
        Served statically under <code>api/</code> — same files the app imports.
      </p>
      <ul className="api-list">
        {API_FILES.map((f) => (
          <li key={f}>
            <a href={`${import.meta.env.BASE_URL}api/${f}`} target="_blank" rel="noreferrer">
              {import.meta.env.BASE_URL}api/{f}
            </a>
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: '1.6rem' }}>Agent brief</h2>
      <div className="copy-row">
        <button className="btn sm" onClick={() => copy('brief', agentBrief)}>
          {copied === 'brief' ? 'copied ✓' : 'copy agent brief'}
        </button>
        <span className="small muted">paste this into any agent to hand off the session</span>
      </div>
      <pre className="code-panel">{agentBrief}</pre>

      <h2 style={{ marginTop: '1.6rem' }}>Session state</h2>
      <div className="copy-row">
        <button className="btn sm" onClick={() => copy('state', exportBlob)}>
          {copied === 'state' ? 'copied ✓' : 'copy session JSON'}
        </button>
        <span className="small muted">
          journals are the source of truth; <code>derived</code> is included for convenience
        </span>
      </div>
      <pre className="code-panel">{exportBlob}</pre>

      <h2 style={{ marginTop: '1.6rem' }}>Import a session</h2>
      <p className="small muted">
        Paste a previously exported session JSON (the <code>derived</code> block is ignored).
      </p>
      <textarea
        className="import-box"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder='{"version":1,"dating":{…},"scholarships":{…}}'
      />
      <div className="copy-row">
        <button
          className="btn sm"
          disabled={!importText.trim()}
          onClick={() => {
            const err = store.importState(importText)
            setImportMsg(err ? { ok: false, text: err } : { ok: true, text: 'Session imported.' })
          }}
        >
          import
        </button>
        {importMsg && (
          <span className={importMsg.ok ? 'ok-note' : 'err'}>{importMsg.text}</span>
        )}
      </div>

      <h2 style={{ marginTop: '1.6rem' }}>Contract</h2>
      <pre className="code-panel">{JSON.stringify(contract, null, 2)}</pre>
    </div>
  )
}
