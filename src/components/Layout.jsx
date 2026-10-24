import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Network, ClipboardCheck, ClipboardList, FileText, LogOut, Menu, X, Settings, ScrollText, UserRound, IdCard } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

export default function Layout() {
  const { user, profile, signOut, isAdmin, isAdviser, canSeeTracker, setupNeeded } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const nav = isAdviser
    ? [
        { to: '/', label: 'Org Chart', icon: LayoutDashboard, end: true },
        { to: '/account', label: 'My account', icon: UserRound },
        { to: '/members', label: 'Members', icon: Users },
        { to: '/assign', label: 'Assigned Roles', icon: Network },
      ]
    : [
        { to: '/', label: 'Org Chart', icon: LayoutDashboard, end: true },
        ...(!isAdmin ? [{ to: '/account', label: 'My account', icon: UserRound }] : []),
        { to: '/register', label: 'Registration', icon: FileText },
        ...(isAdmin ? [{ to: '/registrations', label: 'eRegForms', icon: ClipboardList }] : []),
        ...(isAdmin
          ? [
              { to: '/members', label: 'Members', icon: Users },
              { to: '/assign', label: 'Assign Roles', icon: Network },
              { to: '/users', label: 'Users', icon: IdCard },
            ]
          : []),
        ...(canSeeTracker ? [{ to: '/tracker', label: 'Tracker', icon: ClipboardCheck }] : []),
        ...(isAdmin
          ? [
              { to: '/settings', label: 'Settings', icon: Settings },
              { to: '/audit', label: 'Audit log', icon: ScrollText },
            ]
          : []),
      ]

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
        <button className="icon-btn" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
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
          {nav.map(({ to, label, icon: Icon, end }) => (
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
              <span>{profile?.username || user?.email}</span>
            </div>
          </div>
          <button className="btn btn-sidebar" onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={17} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <main className="main">
        {isAdmin && setupNeeded && (
          <div className="alert">
            Member accounts are not in Supabase yet. Run <code>supabase/accounts.sql</code> in the SQL Editor.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
