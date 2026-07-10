import type {
  Archetype,
  Candidate,
  Contribution,
  Facet,
  Fact,
  FactSheet,
  FeedbackEvent,
  FitResult,
  PreferenceModel,
  Reason,
  ScoreResult,
  TraitKey,
} from './types'

export const traitKey = (facetId: string, valueId: string): TraitKey =>
  `${facetId}:${valueId}`

export function candidateTraits(candidate: Candidate): TraitKey[] {
  const keys: TraitKey[] = []
  for (const [facetId, value] of Object.entries(candidate.attributes)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      keys.push(traitKey(facetId, v))
    }
  }
  return keys
}

export function traitLabel(key: TraitKey, facets: Facet[]): string {
  const [facetId, valueId] = key.split(':')
  const facet = facets.find((f) => f.id === facetId)
  const value = facet?.values.find((v) => v.id === valueId)
  if (facet && value) return `${facet.label}: ${value.label}`
  return key
}

/** Build the starting preference model from chosen archetypes. */
export function seedModel(archetypes: Archetype[]): PreferenceModel {
  const weights: Record<TraitKey, number> = {}
  const vetoes = new Set<TraitKey>()
  for (const a of archetypes) {
    for (const [k, w] of Object.entries(a.seedWeights ?? {})) {
      weights[k] = (weights[k] ?? 0) + w
    }
    for (const v of a.seedVetoes ?? []) vetoes.add(v)
  }
  return { weights, vetoes: [...vetoes], archetypeIds: archetypes.map((a) => a.id) }
}

/**
 * Fold one feedback event into the model. Pure — returns a new model.
 * Reasons carry the semantics; a bare verdict without reasons nudges nothing
 * except a small like/pass drift on the candidate's own traits, so feedback
 * WITH reasons is strictly more powerful than swiping.
 */
export function applyFeedback(
  model: PreferenceModel,
  event: FeedbackEvent,
  candidate: Candidate,
  reasons: Reason[],
): PreferenceModel {
  const weights = { ...model.weights }
  const vetoes = new Set(model.vetoes)
  const bump = (k: TraitKey, d: number) => {
    weights[k] = Math.round(((weights[k] ?? 0) + d) * 100) / 100
  }

  const picked = event.reasonIds
    .map((id) => reasons.find((r) => r.id === id))
    .filter((r): r is Reason => !!r)

  if (picked.length === 0) {
    // Reason-free drift: gentle, so unexplained swipes barely move the model.
    const drift = event.verdict === 'like' ? 0.2 : event.verdict === 'pass' ? -0.2 : 0
    if (drift !== 0) for (const k of candidateTraits(candidate)) bump(k, drift)
  }

  for (const reason of picked) {
    for (const effect of reason.effects ?? []) {
      if (effect.veto) vetoes.add(effect.traitKey)
      if (effect.delta) bump(effect.traitKey, effect.delta)
    }
    for (const mf of reason.matchingFacets ?? []) {
      const value = candidate.attributes[mf.facetId]
      if (value === undefined) continue
      for (const v of Array.isArray(value) ? value : [value]) {
        bump(traitKey(mf.facetId, v), mf.delta)
      }
    }
  }

  return { ...model, weights, vetoes: [...vetoes] }
}

/** Replay a whole journal — the model is always derivable from events. */
export function replayFeedback(
  seed: PreferenceModel,
  events: FeedbackEvent[],
  candidates: Candidate[],
  reasons: Reason[],
): PreferenceModel {
  return [...events]
    .sort((a, b) => a.ts - b.ts)
    .reduce((m, e) => {
      const c = candidates.find((x) => x.id === e.candidateId)
      return c ? applyFeedback(m, e, c, reasons) : m
    }, seed)
}

/** Score one candidate with a full per-trait explanation. */
export function scoreCandidate(
  candidate: Candidate,
  model: PreferenceModel,
  facets: Facet[],
): ScoreResult {
  const traits = candidateTraits(candidate)
  const excludedBy = traits
    .filter((t) => model.vetoes.includes(t))
    .map((t) => ({ traitKey: t, label: traitLabel(t, facets) }))

  const contributions: Contribution[] = traits
    .filter((t) => (model.weights[t] ?? 0) !== 0)
    .map((t) => ({
      traitKey: t,
      label: traitLabel(t, facets),
      amount: model.weights[t],
      source: 'feedback' as const,
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  const score =
    Math.round(contributions.reduce((s, c) => s + c.amount, 0) * 100) / 100

  return {
    candidateId: candidate.id,
    score,
    excluded: excludedBy.length > 0,
    excludedBy,
    contributions,
  }
}

export function rankCandidates(
  candidates: Candidate[],
  model: PreferenceModel,
  facets: Facet[],
): ScoreResult[] {
  return candidates
    .map((c) => scoreCandidate(c, model, facets))
    .sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.score - a.score)
}

/** Scholarship-side: bucket a candidate against the user's fact sheet. */
export function fitCandidate(
  candidate: Candidate,
  factSheet: FactSheet,
  facts: Fact[],
): FitResult {
  const reqs = candidate.requirements ?? []
  const rows = reqs.map((r) => {
    const answer = factSheet[r.factId] ?? 'unknown'
    const status: 'met' | 'blocked' | 'open' =
      answer === 'yes' ? 'met' : answer === 'no' && r.required ? 'blocked' : 'open'
    return { factId: r.factId, label: r.label, required: r.required, answer, status }
  })

  const required = rows.filter((r) => r.required)
  const blocked = required.some((r) => r.status === 'blocked')
  const allMet = required.length > 0 && required.every((r) => r.status === 'met')
  const bucket = blocked ? 'not-a-fit' : allMet ? 'eligible' : 'maybe'

  const wouldFitIf = blocked
    ? []
    : required
        .filter((r) => r.status === 'open')
        .map((r) => {
          const fact = facts.find((f) => f.id === r.factId)
          return { factId: r.factId, question: fact?.question ?? r.label }
        })

  return {
    candidateId: candidate.id,
    bucket,
    satisfied: required.filter((r) => r.status === 'met').length,
    requiredCount: required.length,
    rows,
    wouldFitIf,
  }
}

export function bucketAll(
  candidates: Candidate[],
  factSheet: FactSheet,
  facts: Fact[],
): FitResult[] {
  const order = { eligible: 0, maybe: 1, 'not-a-fit': 2 } as const
  return candidates
    .map((c) => fitCandidate(c, factSheet, facts))
    .sort(
      (a, b) =>
        order[a.bucket] - order[b.bucket] ||
        b.satisfied / Math.max(1, b.requiredCount) -
          a.satisfied / Math.max(1, a.requiredCount),
    )
}
