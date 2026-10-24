import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import OrgChart from './pages/OrgChart'
import Members from './pages/Members'
import Assignments from './pages/Assignments'
import Tracker from './pages/Tracker'
import Login from './pages/Login'
import Register from './pages/Register'
import Registrations from './pages/Registrations'
import Account from './pages/Account'
import Users from './pages/Users'
import Settings from './pages/Settings'
import AuditLog from './pages/AuditLog'
import ChangePassword from './pages/ChangePassword'
import Landing from './pages/Landing'
import { useAuth } from './context/AuthContext'
import { supabaseConfigured } from './supabaseClient'

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  )
}

function RequireAuth({ children }) {
  const { session, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <PageLoader />
  if (!session) {
    if (location.pathname === '/') return <Navigate to="/welcome" replace />
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}

function RequireFreshPassword({ children }) {
  const { mustChangePassword } = useAuth()
  if (mustChangePassword) return <Navigate to="/password" replace />
  return children
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/account" replace />
  return children
}

function RequireOrgStaff({ children }) {
  const { isAdmin, isAdviser } = useAuth()
  if (!isAdmin && !isAdviser) return <Navigate to="/account" replace />
  return children
}

function MemberRegister() {
  const { isAdviser } = useAuth()
  if (isAdviser) return <Navigate to="/" replace />
  return <Register />
}

function RequireTracker({ children }) {
  const { canSeeTracker } = useAuth()
  if (!canSeeTracker) return <Navigate to="/account" replace />
  return children
}

function MemberAccount() {
  const { isAdmin } = useAuth()
  if (isAdmin) return <Navigate to="/users" replace />
  return <Account />
}

function PasswordGate() {
  const { mustChangePassword, ready } = useAuth()
  if (!ready) return <PageLoader />
  if (!mustChangePassword) return <Navigate to="/account" replace />
  return <ChangePassword forced />
}

export default function App() {
  if (!supabaseConfigured) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Supabase not configured</h1>
          <p className="muted">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file
            (or Vercel environment variables) and restart.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/welcome" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/password"
        element={
          <RequireAuth>
            <PasswordGate />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <RequireFreshPassword>
              <Layout />
            </RequireFreshPassword>
          </RequireAuth>
        }
      >
        <Route index element={<OrgChart />} />
        <Route path="account" element={<MemberAccount />} />
        <Route path="register" element={<MemberRegister />} />
        <Route
          path="registrations"
          element={
            <RequireAdmin>
              <Registrations />
            </RequireAdmin>
          }
        />
        <Route
          path="members"
          element={
            <RequireOrgStaff>
              <Members />
            </RequireOrgStaff>
          }
        />
        <Route
          path="assign"
          element={
            <RequireOrgStaff>
              <Assignments />
            </RequireOrgStaff>
          }
        />
        <Route
          path="tracker"
          element={
            <RequireTracker>
              <Tracker />
            </RequireTracker>
          }
        />
        <Route
          path="users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />
        <Route
          path="settings"
          element={
            <RequireAdmin>
              <Settings />
            </RequireAdmin>
          }
        />
        <Route
          path="audit"
          element={
            <RequireAdmin>
              <AuditLog />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
