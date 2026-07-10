import { useMemo, useState } from 'react'
import ArchetypePicker from '../components/ArchetypePicker'
import {
  applyFeedback,
  rankCandidates,
  traitLabel,
} from '../engine/scoring'
import type {
  Candidate,
  FeedbackEvent,
  ScoreResult,
  Verdict,
} from '../engine/types'
import { fixtures, useStore } from '../state/store'

const { profiles, datingFacets, datingReasons, datingArchetypes } = fixtures

type Filters = Record<string, string[]>

function passesFilters(c: Candidate, filters: Filters): boolean {
  return Object.entries(filters).every(([facetId, wanted]) => {
    if (wanted.length === 0) return true
    const val = c.attributes[facetId]
    const vals = Array.isArray(val) ? val : [val]
    return wanted.some((w) => vals.includes(w))
  })
}

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100
  return r > 0 ? `+${r}` : `${r}`
}

/** Per-trait weight diff between two models, for the "what changed" toast. */
function weightDelta(
  before: Record<string, number>,
  after: Record<string, number>,
): { traitKey: string; delta: number }[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const out: { traitKey: string; delta: number }[] = []
  for (const k of keys) {
    const d = Math.round(((after[k] ?? 0) - (before[k] ?? 0)) * 100) / 100
    if (d !== 0) out.push({ traitKey: k, delta: d })
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

interface Toast {
  candidateName: string
  verdict: Verdict
  changes: { traitKey: string; delta: number }[]
  newVetoes: string[]
}

export default function DatePage() {
  const store = useStore()
  const { state, datingModel } = store
  const [pickerSel, setPickerSel] = useState<string[]>([])
  const [filters, setFilters] = useState<Filters>({})
  const [openReasonFor, setOpenReasonFor] = useState<{
    candidateId: string
    verdict: Verdict
  } | null>(null)
  const [reasonSel, setReasonSel] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [showPassed, setShowPassed] = useState(false)

  const started = state.dating.archetypeIds.length > 0 || state.dating.events.length > 0

  const latestVerdict = useMemo(() => {
    const m = new Map<string, FeedbackEvent>()
    for (const e of state.dating.events) m.set(e.candidateId, e)
    return m
  }, [state.dating.events])

  const ranked: ScoreResult[] = useMemo(
    () => rankCandidates(profiles, datingModel, datingFacets),
    [datingModel],
  )

  const visible = ranked.filter((r) => {
    const c = profiles.find((p) => p.id === r.candidateId)!
    return passesFilters(c, filters)
  })

  const shortlist = visible.filter((r) => latestVerdict.get(r.candidateId)?.verdict === 'like')
  const passed = visible.filter((r) => latestVerdict.get(r.candidateId)?.verdict === 'pass')
  const toReview = visible.filter(
    (r) => !['like', 'pass'].includes(latestVerdict.get(r.candidateId)?.verdict ?? ''),
  )

  if (!started) {
    return (
      <ArchetypePicker
        title="Who are you looking for?"
        intro="Pick one or more starting archetypes. They seed a preference model you'll refine with every judgment — with reasons, not just swipes."
        archetypes={datingArchetypes}
        selected={pickerSel}
        accent="var(--terra)"
        onToggle={(id) =>
          setPickerSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
        }
        onStart={() => store.setDatingArchetypes(pickerSel)}
        startLabel="Start browsing →"
      />
    )
  }

  const toggleFilter = (facetId: string, valueId: string) =>
    setFilters((f) => {
      const cur = f[facetId] ?? []
      return {
        ...f,
        [facetId]: cur.includes(valueId) ? cur.filter((v) => v !== valueId) : [...cur, valueId],
      }
    })

  const beginVerdict = (candidateId: string, verdict: Verdict) => {
    setOpenReasonFor({ candidateId, verdict })
    setReasonSel([])
    setNote('')
  }

  const confirmVerdict = () => {
    if (!openReasonFor) return
    const candidate = profiles.find((p) => p.id === openReasonFor.candidateId)!
    const event = {
      domain: 'dating' as const,
      candidateId: candidate.id,
      verdict: openReasonFor.verdict,
      reasonIds: reasonSel,
      note: note.trim() || undefined,
    }
    // Preview the model shift so the toast can say exactly what changed.
    const after = applyFeedback(
      datingModel,
      { ...event, id: 'preview', ts: Date.now() },
      candidate,
      datingReasons,
    )
    setToast({
      candidateName: candidate.name,
      verdict: openReasonFor.verdict,
      changes: weightDelta(datingModel.weights, after.weights).slice(0, 5),
      newVetoes: after.vetoes.filter((v) => !datingModel.vetoes.includes(v)),
    })
    store.addFeedback(event)
    setOpenReasonFor(null)
  }

  const topWeights = Object.entries(datingModel.weights)
    .filter(([, w]) => w !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 8)

  const renderCard = (r: ScoreResult) => {
    const c = profiles.find((p) => p.id === r.candidateId)!
    const verdict = latestVerdict.get(c.id)
    const reasonOpen = openReasonFor?.candidateId === c.id
    const applicableReasons = reasonOpen
      ? datingReasons.filter((re) => re.appliesTo.includes(openReasonFor!.verdict))
      : []
    return (
      <article key={c.id} className={`cand-card ${r.excluded ? 'excluded' : ''}`}>
        <div className="cand-head">
          <h3>{c.name}</h3>
          {verdict && (
            <span className={`reviewed-stamp ${verdict.verdict}`}>
              {verdict.verdict === 'like' ? 'shortlisted' : verdict.verdict}
            </span>
          )}
          <span className={`score-pill ${r.score > 0 ? 'pos' : r.score < 0 ? 'neg' : ''}`}>
            {r.excluded ? 'excluded' : `fit ${fmt(r.score)}`}
          </span>
        </div>
        <p className="cand-tagline">{c.tagline}</p>
        <div className="chips">
          {Object.entries(c.attributes).flatMap(([facetId, val]) => {
            const facet = datingFacets.find((f) => f.id === facetId)
            if (!facet || facetId === 'effort') return []
            return (Array.isArray(val) ? val : [val]).map((v) => (
              <span key={`${facetId}:${v}`} className="chip static">
                {facet.values.find((x) => x.id === v)?.label ?? v}
              </span>
            ))
          })}
        </div>
        {c.prompts?.map((p) => (
          <div key={p.prompt} className="prompt-block">
            <div className="q">{p.prompt}</div>
            <div className="a">{p.answer}</div>
          </div>
        ))}
        <details className="why">
          <summary>
            why this {r.excluded ? 'is excluded' : 'appears here'} · {r.contributions.length}{' '}
            factor{r.contributions.length === 1 ? '' : 's'}
          </summary>
          {r.excludedBy.length > 0 && (
            <ul className="why-rows">
              {r.excludedBy.map((x) => (
                <li key={x.traitKey}>
                  <span>⊘ dealbreaker: {x.label}</span>
                </li>
              ))}
            </ul>
          )}
          <ul className="why-rows">
            {r.contributions.map((x) => (
              <li key={x.traitKey}>
                <span>{x.label}</span>
                <span className={`amt ${x.amount > 0 ? 'pos' : 'neg'}`}>{fmt(x.amount)}</span>
              </li>
            ))}
            {r.contributions.length === 0 && (
              <li>
                <span className="muted">
                  No signal yet — your feedback will start shaping this.
                </span>
              </li>
            )}
          </ul>
        </details>
        <div className="verdict-bar">
          {(['like', 'unsure', 'pass'] as Verdict[]).map((v) => (
            <button
              key={v}
              className={`verdict-btn ${v} ${reasonOpen && openReasonFor!.verdict === v ? 'on' : ''}`}
              onClick={() => beginVerdict(c.id, v)}
            >
              {v === 'like' ? '✓ like' : v === 'pass' ? '✗ pass' : '? unsure'}
            </button>
          ))}
        </div>
        {reasonOpen && (
          <div className="reason-sheet">
            <div className="rs-title">
              Why {openReasonFor!.verdict === 'like' ? 'do you like' : openReasonFor!.verdict === 'pass' ? 'are you passing on' : 'are you unsure about'}{' '}
              {c.name.split(',')[0]}? <span className="muted">(reasons teach the model)</span>
            </div>
            <div className="reason-opts">
              {applicableReasons.map((re) => (
                <button
                  key={re.id}
                  className={`reason-opt ${reasonSel.includes(re.id) ? 'on' : ''}`}
                  onClick={() =>
                    setReasonSel((s) =>
                      s.includes(re.id) ? s.filter((x) => x !== re.id) : [...s, re.id],
                    )
                  }
                >
                  {re.label}
                </button>
              ))}
            </div>
            <input
              className="reason-note"
              placeholder="optional note to self…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn terra sm" onClick={confirmVerdict}>
                record {openReasonFor!.verdict}
              </button>
              <button className="btn ghost sm" onClick={() => setOpenReasonFor(null)}>
                cancel
              </button>
            </div>
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="workbench" style={{ ['--accent' as never]: 'var(--terra)' }}>
      <aside className="sidebar">
        <div className="pane">
          <h3>Narrow down</h3>
          {datingFacets
            .filter((f) => f.filterable)
            .map((f) => (
              <div key={f.id} className="facet-block">
                <div className="facet-name">{f.label}</div>
                <div className="chips">
                  {f.values.map((v) => (
                    <button
                      key={v.id}
                      className={`chip ${(filters[f.id] ?? []).includes(v.id) ? 'on' : ''}`}
                      onClick={() => toggleFilter(f.id, v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          <button className="btn ghost sm" onClick={() => setFilters({})}>
            clear filters
          </button>
        </div>
        <div className="pane">
          <h3>Archetypes</h3>
          <div className="chips">
            {datingArchetypes.map((a) => (
              <button
                key={a.id}
                className={`chip ${state.dating.archetypeIds.includes(a.id) ? 'on' : ''}`}
                onClick={() =>
                  store.setDatingArchetypes(
                    state.dating.archetypeIds.includes(a.id)
                      ? state.dating.archetypeIds.filter((x) => x !== a.id)
                      : [...state.dating.archetypeIds, a.id],
                  )
                }
              >
                {a.label}
              </button>
            ))}
          </div>
          <button
            className="btn ghost sm"
            style={{ marginTop: '0.7rem' }}
            onClick={() => {
              store.resetDomain('dating')
              setPickerSel([])
              setFilters({})
            }}
          >
            reset session
          </button>
        </div>
      </aside>

      <section>
        {toast && (
          <div className="delta-toast" role="status">
            Recorded <b>{toast.verdict}</b> on {toast.candidateName}.{' '}
            {toast.newVetoes.map((v) => (
              <span key={v}>
                New dealbreaker: <b>{traitLabel(v, datingFacets)}</b>.{' '}
              </span>
            ))}
            {toast.changes.length > 0 ? (
              <>
                Model shifted:{' '}
                {toast.changes.map((ch, i) => (
                  <span key={ch.traitKey}>
                    {i > 0 && ' · '}
                    {traitLabel(ch.traitKey, datingFacets)}{' '}
                    <span className={`amt ${ch.delta > 0 ? 'pos' : 'neg'}`}>{fmt(ch.delta)}</span>
                  </span>
                ))}
              </>
            ) : (
              toast.newVetoes.length === 0 && 'No model change (unsure records evidence only).'
            )}
            <button className="undo-btn" onClick={() => setToast(null)}>
              dismiss
            </button>
          </div>
        )}

        {shortlist.length > 0 && (
          <>
            <div className="section-head">
              <h2>Shortlist</h2>
              <span className="count">{shortlist.length}</span>
            </div>
            {shortlist.map(renderCard)}
          </>
        )}

        <div className="section-head">
          <h2>Ranked for you</h2>
          <span className="count">
            {toReview.length} of {profiles.length} · ordered by your evolving model
          </span>
        </div>
        {toReview.map(renderCard)}
        {toReview.length === 0 && (
          <p className="muted">
            Nothing left to review with these filters — widen a facet or check your shortlist.
          </p>
        )}

        {passed.length > 0 && (
          <>
            <div className="section-head">
              <h2 className="muted">Passed</h2>
              <span className="count">{passed.length}</span>
              <button className="undo-btn" onClick={() => setShowPassed((s) => !s)}>
                {showPassed ? 'hide' : 'show'}
              </button>
            </div>
            {showPassed && passed.map(renderCard)}
          </>
        )}
      </section>

      <aside className="journal-col">
        <div className="pane">
          <h3>Your model, right now</h3>
          <div className="model-summary">
            {datingModel.vetoes.map((v) => (
              <div key={v} className="veto-row">
                {traitLabel(v, datingFacets)}
              </div>
            ))}
            {topWeights.map(([k, w]) => (
              <div key={k} className="trait-row">
                <span>{traitLabel(k, datingFacets)}</span>
                <span className={`amt ${w > 0 ? 'pos' : 'neg'}`}>{fmt(w)}</span>
              </div>
            ))}
            {topWeights.length === 0 && datingModel.vetoes.length === 0 && (
              <p className="muted small">Empty — pick archetypes or record feedback.</p>
            )}
          </div>
        </div>
        <div className="pane">
          <h3>Preference journal · {state.dating.events.length}</h3>
          <ul className="journal-list">
            {[...state.dating.events].reverse().map((e) => {
              const c = profiles.find((p) => p.id === e.candidateId)
              return (
                <li key={e.id}>
                  <div className="j-head">
                    <span className="j-name">{c?.name.split(',')[0] ?? e.candidateId}</span>
                    <span className={`j-verdict ${e.verdict}`}>{e.verdict}</span>
                    <button className="undo-btn" onClick={() => store.undoFeedback(e.id)}>
                      undo
                    </button>
                  </div>
                  <div className="j-reasons">
                    {e.reasonIds
                      .map((id) => datingReasons.find((r) => r.id === id)?.label ?? id)
                      .join(' · ') || 'no reason given'}
                    {e.note ? ` — “${e.note}”` : ''}
                  </div>
                </li>
              )
            })}
            {state.dating.events.length === 0 && (
              <li className="muted small">
                Judgments land here. This journal is the source of truth — the model above is
                always replayable from it.
              </li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  )
}
