import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../lib/constants'
import Logo from '../components/Logo'

export default function ChangePassword({ forced = false }) {
  const { profile, refreshAccess, markPasswordChanged, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setBusy(false)
      setError(errorMessage(updateError))
      return
    }
    const { error: flagError } = await supabase.rpc('complete_password_change', { p_password: password })
    setBusy(false)
    if (flagError) {
      setError(flagError.code === 'PGRST202'
        ? 'Run supabase/users.sql in the Supabase SQL Editor, then save the password again.'
        : errorMessage(flagError))
      return
    }
    markPasswordChanged(password)
    await refreshAccess()
    navigate(isAdmin ? '/users' : '/account', { replace: true })
  }

  const fields = (
    <>
      <label className="field">
        <span>New password</span>
        <div className="input-icon">
          <Lock size={17} />
          <input className="input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
      <label className="field">
        <span>Confirm password</span>
        <div className="input-icon">
          <Lock size={17} />
          <input className="input" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
          <button type="button" className="password-toggle" onClick={() => setShowConfirm((current) => !current)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
            {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
    </>
  )

  if (!forced) {
    return (
      <form className="account-pass" onSubmit={handleSubmit}>
        <div className="account-pass-copy">
          <h2>Password</h2>
          <p>Replace the password for this account.</p>
        </div>
        <div className="account-pass-fields">
          {fields}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
      </form>
    )
  }

  const form = (
    <form className="login-card" onSubmit={handleSubmit}>
      <Logo size={88} />
      <div>
        <h1>Choose your password</h1>
        <p className="muted">
          {`${profile?.username || 'This account'} is using a temporary password. Choose a new one before continuing.`}
        </p>
      </div>
      {fields}
      {error && <div className="alert">{error}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Saving…' : 'Save password'}
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={() => signOut().then(() => navigate('/login', { replace: true }))}>
        Sign out
      </button>
    </form>
  )

  if (forced) {
    return (
      <div className="login-page">
        <div className="login-bg" />
        {form}
      </div>
    )
  }
  return form
}
