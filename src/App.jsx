import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import OrgChart from './pages/OrgChart'
import Members from './pages/Members'
import Assignments from './pages/Assignments'
import Login from './pages/Login'
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
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
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
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<OrgChart />} />
        <Route path="members" element={<Members />} />
        <Route path="assign" element={<Assignments />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
