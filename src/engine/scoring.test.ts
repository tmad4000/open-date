import { describe, expect, it } from 'vitest'
import {
  applyFeedback,
  bucketAll,
  candidateTraits,
  fitCandidate,
  rankCandidates,
  replayFeedback,
  scoreCandidate,
  seedModel,
  traitKey,
} from './scoring'
import type { Archetype, Candidate, Fact, FeedbackEvent, Reason } from './types'

import profiles from '../fixtures/dating.profiles.json'
import facetsJson from '../fixtures/dating.facets.json'
import reasonsJson from '../fixtures/dating.reasons.json'
import datingArchetypes from '../fixtures/dating.archetypes.json'
import scholarships from '../fixtures/scholarships.json'
import factsJson from '../fixtures/scholarship.facts.json'
import scholarshipArchetypes from '../fixtures/scholarship.archetypes.json'

const candidates = profiles as unknown as Candidate[]
const facets = facetsJson as never[]
const reasons = reasonsJson as unknown as Reason[]
const facts = factsJson as Fact[]
const awards = scholarships as unknown as Candidate[]

const event = (over: Partial<FeedbackEvent>): FeedbackEvent => ({
  id: 'e1',
  ts: 1,
  domain: 'dating',
  candidateId: 'p-marisol',
  verdict: 'like',
  reasonIds: [],
  ...over,
})

describe('trait extraction', () => {
  it('flattens scalar and array attributes into facet:value keys', () => {
    const marisol = candidates.find((c) => c.id === 'p-marisol')!
    const traits = candidateTraits(marisol)
    expect(traits).toContain('kids:open')
    expect(traits).toContain('values:curiosity')
    expect(traits).toContain('values:community')
  })
})

describe('archetype seeding', () => {
  it('sums weights across archetypes and unions vetoes', () => {
    const model = seedModel(datingArchetypes as unknown as Archetype[])
    expect(model.weights['goal:longterm']).toBeGreaterThan(2) // settle-down + others
    expect(model.vetoes).toContain('kids:wants') // childfree archetype
  })
})

describe('feedback application', () => {
  const seed = seedModel([])

  it('reason with fixed effect bumps that trait', () => {
    const marisol = candidates.find((c) => c.id === 'p-marisol')!
    const m = applyFeedback(seed, event({ reasonIds: ['curious-mind'] }), marisol, reasons)
    expect(m.weights['values:curiosity']).toBe(1.5)
  })

  it('matching-facet reason boosts the candidate\'s own values', () => {
    const marisol = candidates.find((c) => c.id === 'p-marisol')!
    const m = applyFeedback(seed, event({ reasonIds: ['values-align'] }), marisol, reasons)
    expect(m.weights['values:curiosity']).toBe(1)
    expect(m.weights['values:community']).toBe(1)
    expect(m.weights['values:stability']).toBeUndefined()
  })

  it('dealbreaker reason adds a veto that excludes future candidates', () => {
    const devon = candidates.find((c) => c.id === 'p-devon')! // wants kids
    const m = applyFeedback(
      seed,
      event({ candidateId: 'p-devon', verdict: 'pass', reasonIds: ['wants-kids-db'] }),
      devon,
      reasons,
    )
    expect(m.vetoes).toContain('kids:wants')
    const theo = candidates.find((c) => c.id === 'p-theo')! // also wants kids
    const scored = scoreCandidate(theo, m, facets)
    expect(scored.excluded).toBe(true)
    expect(scored.excludedBy[0].traitKey).toBe('kids:wants')
  })

  it('reason-free verdicts drift gently, unsure not at all', () => {
    const marisol = candidates.find((c) => c.id === 'p-marisol')!
    const liked = applyFeedback(seed, event({}), marisol, reasons)
    expect(liked.weights['values:curiosity']).toBe(0.2)
    const unsure = applyFeedback(seed, event({ verdict: 'unsure' }), marisol, reasons)
    expect(Object.keys(unsure.weights)).toHaveLength(0)
  })

  it('replay is order-stable and derives the same model from the journal', () => {
    const events = [
      event({ id: 'a', ts: 2, reasonIds: ['curious-mind'] }),
      event({ id: 'b', ts: 1, candidateId: 'p-marcus', verdict: 'pass', reasonIds: ['low-effort'] }),
    ]
    const m1 = replayFeedback(seed, events, candidates, reasons)
    const m2 = replayFeedback(seed, [...events].reverse(), candidates, reasons)
    expect(m1).toEqual(m2)
    expect(m1.weights['effort:low']).toBe(-1.5)
    expect(m1.weights['values:curiosity']).toBe(1.5)
  })
})

describe('ranking and explanation', () => {
  it('every score decomposes into labeled contributions', () => {
    const model = seedModel(
      (datingArchetypes as unknown as Archetype[]).filter((a) => a.id === 'curious-explorer'),
    )
    const ranked = rankCandidates(candidates, model, facets)
    const top = ranked[0]
    const sum = top.contributions.reduce((s, c) => s + c.amount, 0)
    expect(Math.round(sum * 100) / 100).toBe(top.score)
    expect(top.contributions[0].label).toMatch(/: /) // human-readable "Facet: value"
  })

  it('excluded candidates sink below all non-excluded ones', () => {
    const model = seedModel(
      (datingArchetypes as unknown as Archetype[]).filter((a) => a.id === 'no-kids-childfree'),
    )
    const ranked = rankCandidates(candidates, model, facets)
    const firstExcluded = ranked.findIndex((r) => r.excluded)
    expect(firstExcluded).toBeGreaterThan(0)
    expect(ranked.slice(firstExcluded).every((r) => r.excluded)).toBe(true)
  })
})

describe('scholarship fit', () => {
  const sonsOfItaly = awards.find((a) => a.id === 's-sons-of-italy')!

  it('"not 1/4 Italian" knocks out Sons of Italy', () => {
    const fit = fitCandidate(sonsOfItaly, { 'italian-quarter': 'no' }, facts)
    expect(fit.bucket).toBe('not-a-fit')
    expect(fit.wouldFitIf).toHaveLength(0) // blocked, not open
  })

  it('all required facts yes → eligible', () => {
    const fit = fitCandidate(
      sonsOfItaly,
      { 'italian-quarter': 'yes', undergrad: 'yes', 'gpa-30': 'yes', 'essay-ready': 'yes' },
      facts,
    )
    expect(fit.bucket).toBe('eligible')
    expect(fit.satisfied).toBe(4)
  })

  it('unknown required facts → maybe, with "what would make this fit" questions', () => {
    const fit = fitCandidate(sonsOfItaly, { 'italian-quarter': 'yes', undergrad: 'yes' }, facts)
    expect(fit.bucket).toBe('maybe')
    const qs = fit.wouldFitIf.map((w) => w.factId)
    expect(qs).toContain('gpa-30')
    expect(qs).toContain('essay-ready')
  })

  it('one fact answer propagates across every scholarship citing it', () => {
    const results = bucketAll(awards, { 'italian-quarter': 'no', undergrad: 'yes' }, facts)
    const knockedOut = results.filter((r) => r.bucket === 'not-a-fit').map((r) => r.candidateId)
    expect(knockedOut).toContain('s-sons-of-italy')
    expect(knockedOut).toContain('s-arts-italian')
  })

  it('archetype seed facts produce at least one eligible-or-maybe pool', () => {
    const arch = (scholarshipArchetypes as unknown as Archetype[]).find(
      (a) => a.id === 'first-gen-stem-transfer',
    )!
    const results = bucketAll(awards, arch.seedFacts!, facts)
    expect(results.some((r) => r.bucket !== 'not-a-fit')).toBe(true)
    const stem = results.find((r) => r.candidateId === 's-first-gen-stem')!
    expect(['eligible', 'maybe']).toContain(stem.bucket)
  })

  it('optional requirements never block eligibility', () => {
    const needFirst = awards.find((a) => a.id === 's-need-first')!
    const fit = fitCandidate(
      needFirst,
      { 'financial-need': 'yes', undergrad: 'yes', 'gpa-30': 'no', 'essay-ready': 'no' },
      facts,
    )
    expect(fit.bucket).toBe('eligible')
  })
})

describe('shared paradigm', () => {
  it('the same traitKey vocabulary serves both domains', () => {
    expect(traitKey('values', 'curiosity')).toBe('values:curiosity')
    expect(traitKey('field', 'stem')).toBe('field:stem')
  })
})
