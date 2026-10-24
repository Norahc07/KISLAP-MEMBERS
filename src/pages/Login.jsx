import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, ready, signIn, mustChangePassword } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!ready) {
    return (
      <div className="login-page">
        <div className="login-bg" />
        <div className="spinner" />
      </div>
    )
  }

  if (session) {
    if (mustChangePassword) return <Navigate to="/password" replace />
    const from = location.state?.from
    const next = from && from !== '/login' && from !== '/password' ? from : '/'
    return <Navigate to={next} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await signIn(username.trim(), password)
      if (error) {
        setError(error.message === 'Invalid login credentials' ? 'Incorrect username or password.' : error.message)
      }
    } catch {
      setError('Unable to reach the server. Check your internet connection.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <form className="login-card" onSubmit={handleSubmit}>
        <Logo size={120} />
        <div>
          <h1>KISLAP Youth Volunteers</h1>
          <p className="muted">Members sign in with their membership ID. Advisers sign in with their adviser username. The admin username is admin.</p>
        </div>

        <label className="field">
          <span>Username</span>
          <div className="input-icon">
            <UserRound size={17} />
            <input
              className="input"
              autoComplete="username"
              placeholder="KISLAP-26-001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
        </label>
        <label className="field">
          <span>Password</span>
          <div className="input-icon">
            <Lock size={17} />
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        {error && <div className="alert">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small">After the first sign-in, choose your own password. It is saved to your account immediately.</p>
      </form>
    </div>
  )
}
