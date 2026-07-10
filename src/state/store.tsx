import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Archetype,
  Candidate,
  Fact,
  FactAnswer,
  FactEvent,
  FactSheet,
  Facet,
  FeedbackEvent,
  PreferenceModel,
  Reason,
} from '../engine/types'
import { replayFeedback, seedModel } from '../engine/scoring'

import profilesJson from '../fixtures/dating.profiles.json'
import datingFacetsJson from '../fixtures/dating.facets.json'
import datingReasonsJson from '../fixtures/dating.reasons.json'
import datingArchetypesJson from '../fixtures/dating.archetypes.json'
import scholarshipsJson from '../fixtures/scholarships.json'
import factsJson from '../fixtures/scholarship.facts.json'
import scholarshipArchetypesJson from '../fixtures/scholarship.archetypes.json'

export const fixtures = {
  profiles: profilesJson as unknown as Candidate[],
  datingFacets: datingFacetsJson as unknown as Facet[],
  datingReasons: datingReasonsJson as unknown as Reason[],
  datingArchetypes: datingArchetypesJson as unknown as Archetype[],
  scholarships: scholarshipsJson as unknown as Candidate[],
  facts: factsJson as unknown as Fact[],
  scholarshipArchetypes: scholarshipArchetypesJson as unknown as Archetype[],
}

export type Theme = 'light' | 'dark' | 'system'

export interface SessionState {
  version: 1
  dating: { archetypeIds: string[]; events: FeedbackEvent[] }
  scholarships: { archetypeIds: string[]; factEvents: FactEvent[] }
  theme: Theme
}

const EMPTY: SessionState = {
  version: 1,
  dating: { archetypeIds: [], events: [] },
  scholarships: { archetypeIds: [], factEvents: [] },
  theme: 'system',
}

const STORAGE_KEY = 'open-date:v1'

function load(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return EMPTY
    return { ...EMPTY, ...parsed }
  } catch {
    return EMPTY
  }
}

interface Store {
  state: SessionState
  datingModel: PreferenceModel
  factSheet: FactSheet
  setDatingArchetypes: (ids: string[]) => void
  setScholarshipArchetypes: (ids: string[]) => void
  addFeedback: (e: Omit<FeedbackEvent, 'id' | 'ts'>) => void
  undoFeedback: (id: string) => void
  answerFact: (factId: string, answer: FactAnswer) => void
  setTheme: (t: Theme) => void
  resetDomain: (domain: 'dating' | 'scholarships') => void
  importState: (json: string) => string | null
}

const Ctx = createContext<Store | null>(null)

let counter = 0
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark =
        state.theme === 'dark' ||
        (state.theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [state.theme])

  const datingModel = useMemo(() => {
    const chosen = fixtures.datingArchetypes.filter((a) =>
      state.dating.archetypeIds.includes(a.id),
    )
    return replayFeedback(
      seedModel(chosen),
      state.dating.events,
      fixtures.profiles,
      fixtures.datingReasons,
    )
  }, [state.dating])

  const factSheet = useMemo(() => {
    const sheet: FactSheet = {}
    for (const a of fixtures.scholarshipArchetypes) {
      if (state.scholarships.archetypeIds.includes(a.id)) {
        Object.assign(sheet, a.seedFacts)
      }
    }
    for (const e of [...state.scholarships.factEvents].sort((a, b) => a.ts - b.ts)) {
      sheet[e.factId] = e.answer
    }
    return sheet
  }, [state.scholarships])

  const setDatingArchetypes = useCallback(
    (ids: string[]) =>
      setState((s) => ({ ...s, dating: { ...s.dating, archetypeIds: ids } })),
    [],
  )
  const setScholarshipArchetypes = useCallback(
    (ids: string[]) =>
      setState((s) => ({
        ...s,
        scholarships: { ...s.scholarships, archetypeIds: ids },
      })),
    [],
  )
  const addFeedback = useCallback(
    (e: Omit<FeedbackEvent, 'id' | 'ts'>) =>
      setState((s) => ({
        ...s,
        dating: {
          ...s.dating,
          events: [...s.dating.events, { ...e, id: uid(), ts: Date.now() }],
        },
      })),
    [],
  )
  const undoFeedback = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        dating: { ...s.dating, events: s.dating.events.filter((e) => e.id !== id) },
      })),
    [],
  )
  const answerFact = useCallback(
    (factId: string, answer: FactAnswer) =>
      setState((s) => ({
        ...s,
        scholarships: {
          ...s.scholarships,
          factEvents: [
            ...s.scholarships.factEvents,
            { id: uid(), ts: Date.now(), factId, answer },
          ],
        },
      })),
    [],
  )
  const setTheme = useCallback((theme: Theme) => setState((s) => ({ ...s, theme })), [])
  const resetDomain = useCallback(
    (domain: 'dating' | 'scholarships') =>
      setState((s) =>
        domain === 'dating'
          ? { ...s, dating: { archetypeIds: [], events: [] } }
          : { ...s, scholarships: { archetypeIds: [], factEvents: [] } },
      ),
    [],
  )
  const importState = useCallback((json: string): string | null => {
    try {
      const parsed = JSON.parse(json)
      if (parsed?.version !== 1 || !parsed.dating || !parsed.scholarships) {
        return 'Not a valid Open Date session export (expected version 1 with dating + scholarships).'
      }
      setState({ ...EMPTY, ...parsed })
      return null
    } catch (e) {
      return `Could not parse JSON: ${e instanceof Error ? e.message : String(e)}`
    }
  }, [])

  const store: Store = {
    state,
    datingModel,
    factSheet,
    setDatingArchetypes,
    setScholarshipArchetypes,
    addFeedback,
    undoFeedback,
    answerFact,
    setTheme,
    resetDomain,
    importState,
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}
