/**
 * Open Date — shared progressive fit filtering engine.
 *
 * One vocabulary serves both verticals:
 *
 *   Candidate    — a person (dating) or a scholarship (scholarships).
 *   Trait        — a facet:value pair a candidate carries ("kids:wants", "heritage:italian").
 *   Facet        — a dimension traits live on, with human labels for explanation.
 *   Archetype    — a named starting point: seed weights (dating) or seed facts (scholarships).
 *   FeedbackEvent— an append-only record of a user judgment with *reasons*, not just a verdict.
 *   PreferenceModel — evolving weights + vetoes derived by folding feedback events.
 *   FactSheet    — the user's own yes/no/unknown answers to requirement facts.
 *   Explanation  — every score/bucket ships with per-trait contributions so any agent
 *                  (or the user) can see exactly why a candidate appeared, rose, or fell.
 */

export type Domain = 'dating' | 'scholarships'

/** A facet:value pair, serialized as "facetId:valueId". */
export type TraitKey = string

export interface FacetValue {
  id: string
  label: string
}

export interface Facet {
  id: string
  label: string
  /** Facets marked filterable render as narrowing chips in the UI. */
  filterable?: boolean
  values: FacetValue[]
}

export interface PromptAnswer {
  prompt: string
  answer: string
}

export interface Candidate {
  id: string
  domain: Domain
  name: string
  tagline: string
  /** facetId -> valueId | valueId[] */
  attributes: Record<string, string | string[]>
  /** Long-form, OKC-style content (dating) or award details (scholarships). */
  prompts?: PromptAnswer[]
  details?: Record<string, string>
  /** Scholarship-only: requirement rows referencing shared fact ids. */
  requirements?: Requirement[]
  /** Provenance for synthetic data. */
  source: string
}

export interface Requirement {
  /** Shared fact id — one user answer propagates to every scholarship citing it. */
  factId: string
  label: string
  required: boolean
}

export interface Fact {
  id: string
  label: string
  /** Short question shown when asking the user to resolve it. */
  question: string
}

export type FactAnswer = 'yes' | 'no' | 'unknown'
export type FactSheet = Record<string, FactAnswer>

export type Verdict = 'like' | 'pass' | 'unsure'

export interface ReasonEffect {
  traitKey: TraitKey
  /** Weight delta applied to the preference model. */
  delta?: number
  /** Hard dealbreaker: candidates carrying this trait are excluded. */
  veto?: boolean
}

export interface Reason {
  id: string
  label: string
  appliesTo: Verdict[]
  /** What accepting this reason does to the preference model.
   *  `matching: true` means effects target the *candidate's own* trait values
   *  on the listed facets (e.g. "values align" boosts whatever values this
   *  candidate holds), rather than a fixed trait key. */
  effects?: ReasonEffect[]
  matchingFacets?: { facetId: string; delta: number }[]
}

export interface FeedbackEvent {
  id: string
  ts: number
  domain: Domain
  candidateId: string
  verdict: Verdict
  reasonIds: string[]
  note?: string
}

export interface FactEvent {
  id: string
  ts: number
  factId: string
  answer: FactAnswer
}

export interface Archetype {
  id: string
  domain: Domain
  label: string
  description: string
  /** Dating: seed weights. */
  seedWeights?: Record<TraitKey, number>
  /** Dating: seed vetoes. */
  seedVetoes?: TraitKey[]
  /** Scholarships: seed fact answers. */
  seedFacts?: FactSheet
}

export interface PreferenceModel {
  weights: Record<TraitKey, number>
  vetoes: TraitKey[]
  archetypeIds: string[]
}

export interface Contribution {
  traitKey: TraitKey
  label: string
  amount: number
  source: 'archetype' | 'feedback'
}

export interface ScoreResult {
  candidateId: string
  score: number
  excluded: boolean
  excludedBy: { traitKey: TraitKey; label: string }[]
  contributions: Contribution[]
}

export type FitBucket = 'eligible' | 'maybe' | 'not-a-fit'

export interface FitResult {
  candidateId: string
  bucket: FitBucket
  /** Requirements satisfied / total required. */
  satisfied: number
  requiredCount: number
  rows: {
    factId: string
    label: string
    required: boolean
    answer: FactAnswer
    status: 'met' | 'blocked' | 'open'
  }[]
  /** "What would make this fit": open required facts, phrased as questions. */
  wouldFitIf: { factId: string; question: string }[]
}
