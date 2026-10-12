import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Mail } from 'lucide-react'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const target = location.state?.from ?? '/members'
  if (session) return <Navigate to={target} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) setError(error.message)
    else navigate(target, { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <form className="login-card" onSubmit={handleSubmit}>
        <Logo size={120} />
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage KISLAP members and roles</p>

        <label className="field">
          <span>Email</span>
          <div className="input-icon">
            <Mail size={17} />
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
        </label>
        <label className="field">
          <span>Password</span>
          <div className="input-icon">
            <Lock size={17} />
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </label>

        {error && <div className="alert">{error}</div>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Back to org chart
        </Link>
      </form>
    </div>
  )
}
