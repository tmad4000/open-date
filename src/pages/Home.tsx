import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <section className="hero">
        <div className="kicker">open source · agent-friendly · no real data</div>
        <h1>
          Narrow down with <em>reasons</em>,<br />
          not just swipes.
        </h1>
        <p className="lede">
          Open Date is a working demo of <strong>progressive fit filtering</strong>: start from
          archetypes, judge candidates with explicit reasons, and watch an explainable
          preference model evolve across sessions. One engine, two very different decisions.
        </p>
      </section>

      <div className="vertical-grid">
        <Link to="/date" className="vertical-card date">
          <span className="domain-tag">vertical 01</span>
          <h2>Dating discovery</h2>
          <p>
            OKCupid-depth profiles — values, dealbreakers, lifestyle, prompts. Like, pass, or
            hold with reasons like “curious mind” or “wants kids (dealbreaker)”. Every judgment
            visibly reshapes your ranking, and a preference journal keeps it multi-session.
          </p>
          <span className="go">open /date →</span>
        </Link>
        <Link to="/scholarships" className="vertical-card schol">
          <span className="domain-tag">vertical 02</span>
          <h2>Scholarship fit</h2>
          <p>
            Same engine, different domain. Mark eligibility facts ✓ ✗ ? — “not ¼ Italian” knocks
            out every Sons-of-Italy-style award at once. Buckets show eligible, maybe, and
            exactly what would make each one fit.
          </p>
          <span className="go">open /scholarships →</span>
        </Link>
      </div>

      <div className="paradigm">
        <h3>The paradigm, in five steps</h3>
        <ol>
          <li>
            <strong>Seed</strong> — pick archetypes that roughly describe you; they set starting
            weights or facts.
          </li>
          <li>
            <strong>Rank</strong> — every candidate is scored or bucketed with a full per-factor
            explanation. Nothing is a black box.
          </li>
          <li>
            <strong>Judge with reasons</strong> — accept, reject, or defer, and say why. Reasons
            carry model semantics; a bare swipe teaches almost nothing.
          </li>
          <li>
            <strong>Evolve</strong> — feedback folds into an append-only journal; the model is
            always replayable from it, and you see exactly what each judgment changed.
          </li>
          <li>
            <strong>Repeat</strong> — sessions persist. Agents can export the state, explain any
            ranking, ask the open questions, and propose new facets.
          </li>
        </ol>
      </div>

      <p className="small muted">
        Everything here is synthetic seed data — no real people, no real awards. For the data
        contract and machine-readable state, see the <Link to="/agent">agent page</Link>.
      </p>
    </div>
  )
}
