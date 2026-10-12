import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Network, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

const NAV = [
  { to: '/', label: 'Org Chart', icon: LayoutDashboard, end: true },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/assign', label: 'Assign Roles', icon: Network },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  function handleSignOut() {
    setSigningOut(true)
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="mobile-bar">
        <div className="brand">
          <Logo size={34} />
          <span>KISLAP</span>
        </div>
        <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Logo size={46} />
          <div>
            <strong>KISLAP</strong>
            <small>Youth Volunteers</small>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link" onClick={() => setOpen(false)}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-dot" />
            <div>
              <small>Signed in as</small>
              <span>{user?.email}</span>
            </div>
          </div>
          <button className="btn btn-sidebar" onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={17} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
