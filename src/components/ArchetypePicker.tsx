import type { Archetype } from '../engine/types'

interface Props {
  title: string
  intro: string
  archetypes: Archetype[]
  selected: string[]
  accent: string
  onToggle: (id: string) => void
  onStart: () => void
  startLabel: string
}

export default function ArchetypePicker({
  title,
  intro,
  archetypes,
  selected,
  accent,
  onToggle,
  onStart,
  startLabel,
}: Props) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="lede">{intro}</p>
      <div className="arch-grid">
        {archetypes.map((a) => (
          <button
            key={a.id}
            className={`arch-card ${selected.includes(a.id) ? 'on' : ''}`}
            style={{ ['--accent' as never]: accent }}
            onClick={() => onToggle(a.id)}
          >
            <h3>{a.label}</h3>
            <p>{a.description}</p>
          </button>
        ))}
      </div>
      <button
        className={`btn ${accent === 'var(--teal)' ? 'teal' : 'terra'}`}
        disabled={selected.length === 0}
        onClick={onStart}
      >
        {startLabel}
      </button>
      <p className="small muted" style={{ marginTop: '0.6rem' }}>
        Archetypes are just a starting point — every judgment you make refines them, and you
        can see exactly what changed.
      </p>
    </section>
  )
}
