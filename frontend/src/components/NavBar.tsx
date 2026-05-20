import { NavLink } from 'react-router-dom'
import { C } from './ui'

const LINKS = [
  { to: '/', label: 'Leaderboard' },
  { to: '/agents', label: 'Agents' },
  { to: '/experiments', label: 'Experiments' },
  { to: '/tasks', label: 'Tasks' },
]

export default function NavBar() {
  return (
    <nav style={{
      background: '#fff',
      borderBottom: `1px solid ${C.gray200}`,
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <span style={{
        fontWeight: 700, fontSize: 15, marginRight: 40, letterSpacing: '-0.3px',
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        <span style={{ color: C.blue600 }}>eval</span>
        <span style={{ color: C.gray400 }}>.platform</span>
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              padding: '0 14px',
              height: 56,
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              color: isActive ? C.gray900 : C.gray500,
              borderBottom: isActive ? `2px solid ${C.blue600}` : '2px solid transparent',
              transition: 'color 0.15s',
            })}
          >
            {label}
          </NavLink>
        ))}
      </div>

      <NavLink
        to="/experiments/new"
        style={({ isActive }) => ({
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 6,
          fontSize: 13, fontWeight: 500,
          background: isActive ? C.blue700 : C.blue600,
          color: '#fff',
          textDecoration: 'none',
          border: 'none',
          whiteSpace: 'nowrap',
        })}
      >
        ▶ Run Experiment
      </NavLink>
    </nav>
  )
}
