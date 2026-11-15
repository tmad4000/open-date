import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useStore, type Theme } from './state/store'
import Home from './pages/Home'
import DatePage from './pages/DatePage'
import ScholarshipsPage from './pages/ScholarshipsPage'
import AgentPage from './pages/AgentPage'

const THEME_NEXT: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' }
const THEME_ICON: Record<Theme, string> = { system: '◐ auto', dark: '● dark', light: '○ light' }

export default function App() {
  const { state, setTheme } = useStore()
  useEffect(() => {
    const loader = document.createElement('script')
    loader.src = 'https://worldissuetracker.com/widget/wit-feedback.js'
    loader.defer = true
    Object.assign(loader.dataset, { trackerSlug: 'open-date-feedback', app: 'Open Date', mode: 'feedback', mountSelector: '#wit-feedback-mount', trigger: 'tab', label: 'Send feedback' })
    document.body.appendChild(loader)
    return () => { loader.remove() }
  }, [])
  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead-inner">
          <NavLink to="/" className="wordmark">
            <span>
              open<span className="mark">✓</span>date
            </span>
            <small>progressive fit filtering</small>
          </NavLink>
          <nav className="nav">
            <NavLink to="/date" className={({ isActive }) => (isActive ? 'active date' : '')}>
              /date
            </NavLink>
            <NavLink
              to="/scholarships"
              className={({ isActive }) => (isActive ? 'active schol' : '')}
            >
              /scholarships
            </NavLink>
            <NavLink to="/agent" className={({ isActive }) => (isActive ? 'active' : '')}>
              /agent
            </NavLink>
            <button
              className="theme-btn"
              onClick={() => setTheme(THEME_NEXT[state.theme])}
              title="Cycle theme"
            >
              {THEME_ICON[state.theme]}
            </button>
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/date" element={<DatePage />} />
          <Route path="/scholarships" element={<ScholarshipsPage />} />
          <Route path="/agent" element={<AgentPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <span className="version-stamp">v{__APP_VERSION__}</span>
        <span id="wit-feedback-mount" />
        <span>open source · MIT</span>
        <a href="https://github.com/tmad4000/open-date">github.com/tmad4000/open-date</a>
        <span>all profiles &amp; scholarships are synthetic</span>
      </footer>
    </div>
  )
}
