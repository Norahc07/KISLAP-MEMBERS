import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Network, ClipboardCheck, ClipboardList, FileText, FolderOpen, CalendarDays, LogOut, Menu, X, Settings, ScrollText, UserRound, IdCard } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import RegisteredVoterPrompt from './RegisteredVoterPrompt'

export default function Layout() {
  const { user, profile, signOut, isAdmin, isAdviser, canAccessPage, setupNeeded } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const documentsLink = { to: '/documents', label: 'Documents', icon: FolderOpen }
  const calendarLink = { to: '/calendar', label: 'Calendar', icon: CalendarDays }
  const nav = isAdviser
    ? [
        { to: '/', label: 'Org Chart', icon: LayoutDashboard, end: true },
        documentsLink,
        calendarLink,
        { to: '/account', label: 'My account', icon: UserRound },
        { to: '/members', label: 'Members', icon: Users },
        { to: '/assign', label: 'Assigned Roles', icon: Network },
      ]
    : [
        { to: '/', label: 'Org Chart', icon: LayoutDashboard, end: true },
        documentsLink,
        calendarLink,
        ...(!isAdmin ? [{ to: '/account', label: 'My account', icon: UserRound }] : []),
        { to: '/register', label: 'Registration', icon: FileText },
        ...(canAccessPage('registrations') ? [{ to: '/registrations', label: 'eRegForms', icon: ClipboardList }] : []),
        ...(canAccessPage('members') ? [{ to: '/members', label: 'Members', icon: Users }] : []),
        ...(canAccessPage('assign') ? [{ to: '/assign', label: 'Assign Roles', icon: Network }] : []),
        ...(canAccessPage('users') ? [{ to: '/users', label: 'Users', icon: IdCard }] : []),
        ...(canAccessPage('tracker') ? [{ to: '/tracker', label: 'Tracker', icon: ClipboardCheck }] : []),
        ...(isAdmin ? [{ to: '/settings', label: 'Settings', icon: Settings }] : []),
        ...(canAccessPage('audit') ? [{ to: '/audit', label: 'Audit log', icon: ScrollText }] : []),
      ]

  function handleSignOut() {
    setSigningOut(true)
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app-shell${open ? ' nav-open' : ''}`}>
      <header className="mobile-bar">
        <div className="brand">
          <Logo size={34} />
          <span>KISLAP</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <aside id="app-sidebar" className={`sidebar ${open ? 'open' : ''}`}>
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
        <RegisteredVoterPrompt />
      </main>
    </div>
  )
}
