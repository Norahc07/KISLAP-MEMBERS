import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Network, LogIn, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

const NAV = [
  { to: '/', label: 'Org Chart', icon: LayoutDashboard, end: true },
  { to: '/members', label: 'Members', icon: Users, admin: true },
  { to: '/assign', label: 'Assign Roles', icon: Network, admin: true },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
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
          {NAV.filter((n) => !n.admin || user).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link" onClick={() => setOpen(false)}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <>
              <div className="user-chip">
                <div className="user-dot" />
                <div>
                  <small>Signed in as</small>
                  <span>{user.email}</span>
                </div>
              </div>
              <button className="btn btn-sidebar" onClick={handleSignOut}>
                <LogOut size={17} /> Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-sidebar" onClick={() => setOpen(false)}>
              <LogIn size={17} /> Admin login
            </NavLink>
          )}
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
