import { useMemo, useState } from 'react'
import ArchetypePicker from '../components/ArchetypePicker'
import { bucketAll } from '../engine/scoring'
import type { FactAnswer, FitBucket, FitResult } from '../engine/types'
import { fixtures, useStore } from '../state/store'

const { scholarships, facts, scholarshipArchetypes } = fixtures

const BUCKET_LABEL: Record<FitBucket, string> = {
  eligible: 'Eligible',
  maybe: 'Maybe — open questions',
  'not-a-fit': 'Not a fit',
}

function TriToggle({
  value,
  onChange,
}: {
  value: FactAnswer
  onChange: (a: FactAnswer) => void
}) {
  return (
    <span className="tri">
      <button
        className={value === 'yes' ? 'on-yes' : ''}
        title="yes"
        onClick={() => onChange('yes')}
      >
        ✓
      </button>
      <button className={value === 'no' ? 'on-no' : ''} title="no" onClick={() => onChange('no')}>
        ✗
      </button>
      <button
        className={value === 'unknown' ? 'on-unknown' : ''}
        title="unknown"
        onClick={() => onChange('unknown')}
      >
        ?
      </button>
    </span>
  )
}

export default function ScholarshipsPage() {
  const store = useStore()
  const { state, factSheet } = store
  const [pickerSel, setPickerSel] = useState<string[]>([])

  const started =
    state.scholarships.archetypeIds.length > 0 || state.scholarships.factEvents.length > 0

  const results = useMemo(() => bucketAll(scholarships, factSheet, facts), [factSheet])

  if (!started) {
    return (
      <ArchetypePicker
        title="Which applicant are you, roughly?"
        intro="Pick the archetypes that fit. They pre-answer eligibility facts — every ✗ you mark afterwards knocks out whole categories at once, the way marking “not ¼ Italian” removes every Sons-of-Italy-style award."
        archetypes={scholarshipArchetypes}
        selected={pickerSel}
        accent="var(--teal)"
        onToggle={(id) =>
          setPickerSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
        }
        onStart={() => store.setScholarshipArchetypes(pickerSel)}
        startLabel="See my fits →"
      />
    )
  }

  const byBucket = (b: FitBucket) => results.filter((r) => r.bucket === b)

  const renderAward = (r: FitResult) => {
    const s = scholarships.find((x) => x.id === r.candidateId)!
    return (
      <article key={s.id} className={`cand-card ${r.bucket === 'not-a-fit' ? 'excluded' : ''}`}>
        <div className="cand-head">
          <h3>{s.name}</h3>
          <span className={`bucket-band ${r.bucket}`}>{BUCKET_LABEL[r.bucket]}</span>
          <span className="score-pill">
            {r.satisfied}/{r.requiredCount} required
          </span>
        </div>
        <p className="cand-tagline">{s.tagline}</p>
        {s.details && (
          <div className="details-row">
            {Object.entries(s.details).map(([k, v]) => (
              <span key={k}>
                <b>{k}:</b> {v}
              </span>
            ))}
          </div>
        )}
        <ul className="req-rows">
          {r.rows.map((row) => (
            <li key={row.factId}>
              <span className={`req-mark ${row.status}`}>
                {row.status === 'met' ? '✓' : row.status === 'blocked' ? '✗' : '?'}
              </span>
              <span>{row.label}</span>
              {!row.required && <span className="opt-tag">optional</span>}
            </li>
          ))}
        </ul>
        {r.wouldFitIf.length > 0 && (
          <div className="would-fit">
            <div className="wf-title">What would make this fit</div>
            {r.wouldFitIf.map((w) => (
              <div key={w.factId} className="wf-row">
                <span className="q">{w.question}</span>
                <TriToggle
                  value={factSheet[w.factId] ?? 'unknown'}
                  onChange={(a) => store.answerFact(w.factId, a)}
                />
              </div>
            ))}
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="workbench" style={{ ['--accent' as never]: 'var(--teal)' }}>
      <aside className="sidebar">
        <div className="pane">
          <h3>Your facts</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            One answer updates every scholarship that cites it.
          </p>
          {facts.map((f) => (
            <div key={f.id} className="fact-row">
              <span className="fact-label">{f.label}</span>
              <TriToggle
                value={factSheet[f.id] ?? 'unknown'}
                onChange={(a) => store.answerFact(f.id, a)}
              />
            </div>
          ))}
          <button
            className="btn ghost sm"
            style={{ marginTop: '0.8rem' }}
            onClick={() => {
              store.resetDomain('scholarships')
              setPickerSel([])
            }}
          >
            reset session
          </button>
        </div>
      </aside>

      <section>
        {(['eligible', 'maybe', 'not-a-fit'] as FitBucket[]).map((bucket) => {
          const list = byBucket(bucket)
          if (list.length === 0) return null
          return (
            <div key={bucket}>
              <div className="section-head">
                <h2>{BUCKET_LABEL[bucket]}</h2>
                <span className="count">{list.length}</span>
              </div>
              {list.map(renderAward)}
            </div>
          )
        })}
      </section>

      <aside className="journal-col">
        <div className="pane">
          <h3>Fit summary</h3>
          <div className="model-summary">
            {(['eligible', 'maybe', 'not-a-fit'] as FitBucket[]).map((b) => (
              <div key={b} className="trait-row">
                <span>{BUCKET_LABEL[b]}</span>
                <span className="amt">{byBucket(b).length}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pane">
          <h3>Answer journal · {state.scholarships.factEvents.length}</h3>
          <ul className="journal-list">
            {[...state.scholarships.factEvents].reverse().map((e) => {
              const f = facts.find((x) => x.id === e.factId)
              return (
                <li key={e.id}>
                  <div className="j-head">
                    <span className="j-name">{f?.label ?? e.factId}</span>
                    <span
                      className={`j-verdict ${
                        e.answer === 'yes' ? 'like' : e.answer === 'no' ? 'pass' : 'unsure'
                      }`}
                    >
                      {e.answer}
                    </span>
                  </div>
                </li>
              )
            })}
            {state.scholarships.factEvents.length === 0 && (
              <li className="muted small">
                Fact answers land here as you refine. Archetype seeds aren't journaled — only
                your explicit answers.
              </li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  )
}
