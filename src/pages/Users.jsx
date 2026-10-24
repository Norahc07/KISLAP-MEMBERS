import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { fetchMemberPhotos } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import { errorMessage } from '../lib/constants'
import { memberCode } from '../lib/tracker'

export default function Users() {
  const { setupNeeded } = useAuth()
  const [rows, setRows] = useState([])
  const [online, setOnline] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [showPasswords, setShowPasswords] = useState(true)
  const [error, setError] = useState('')

  const loadProfiles = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('*')
      .order('username')
    if (queryError) {
      setError(queryError.code === 'PGRST205' ? 'missing' : errorMessage(queryError))
      return
    }
    let photos = new Map()
    try {
      photos = await fetchMemberPhotos()
    } catch {
      photos = new Map()
    }
    setRows(
      (data || [])
        .map((row) => ({ ...row, photo_url: row.photo_url || photos.get(row.member_no) || null }))
        .sort((a, b) => {
          if (a.member_no && b.member_no) return a.member_no - b.member_no
          if (a.member_no) return -1
          if (b.member_no) return 1
          return (a.full_name || a.username).localeCompare(b.full_name || b.username)
        }),
    )
    setError('')
  }, [])

  const loadOnline = useCallback(async () => {
    const { data, error: queryError } = await supabase.rpc('online_user_ids')
    if (queryError) return
    const ids = (data || []).map((row) => row.user_id).filter(Boolean)
    setOnline(new Set(ids))
  }, [])

  useEffect(() => {
    loadProfiles()
    loadOnline()
    const timer = setInterval(() => {
      loadProfiles()
      loadOnline()
    }, 10000)
    const channel = supabase
      .channel('user-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, loadOnline)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadProfiles)
      .subscribe()
    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [loadOnline, loadProfiles])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (!q) return true
      return row.username.toLowerCase().includes(q) || row.full_name.toLowerCase().includes(q)
    })
  }, [rows, query])

  const activeCount = rows.filter((row) => online.has(row.id)).length
  const memberIds = rows.filter((row) => row.member_no).length
  const changedCount = rows.filter((row) => row.role !== 'admin' && row.must_change_password === false).length

  function passwordChanged(row) {
    return row.role !== 'admin' && row.must_change_password === false
  }

  function accountLabel(row) {
    if (row.member_no) return memberCode(row.member_no)
    if (row.role === 'adviser') return 'Adviser'
    if (row.role === 'admin') return 'Admin'
    return row.role
  }

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Users</h1>
          <p className="muted">
            {rows.length} accounts · {memberIds} membership IDs · {activeCount} active · {changedCount} changed their password.
          </p>
        </div>
        <button type="button" className="btn btn-soft password-toggle-btn" onClick={() => setShowPasswords((current) => !current)}>
          {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPasswords ? 'Hide passwords' : 'Show passwords'}
        </button>
      </header>

      {(setupNeeded || error === 'missing') && (
        <div className="alert">Run <code>supabase/users.sql</code> in the Supabase SQL Editor, then refresh this page.</div>
      )}
      {error && error !== 'missing' && <div className="alert">{error}</div>}

      <p className="password-legend">
        <i />
        Green mark means this person already replaced the default password.
      </p>

      <div className="search search-block">
        <Search size={17} />
        <input placeholder="Search username or name" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="data-table users-table">
          <colgroup>
            <col className="users-col-profile" />
            <col className="users-col-username" />
            <col className="users-col-password" />
            <col className="users-col-status" />
          </colgroup>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Username</th>
              <th>Password</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const active = online.has(row.id)
              const changed = passwordChanged(row)
              return (
                <tr key={row.id} className={changed ? 'password-changed' : ''}>
                  <td>
                    <div className="tracker-person">
                      <Avatar src={row.photo_url} name={row.full_name || row.username} size={40} />
                      <div>
                        <strong>{row.full_name || 'No name yet'}</strong>
                        <span className="user-meta">{accountLabel(row)}</span>
                        {changed && <span className="password-mark">Password changed</span>}
                      </div>
                    </div>
                  </td>
                  <td>{row.username}</td>
                  <td className="password-cell">
                    <span>{showPasswords ? row.initial_password || '—' : '••••••••••'}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${active ? 'active' : ''}`}>
                      <i />
                      {active ? 'Active' : 'Offline'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {!visible.length && (
              <tr>
                <td colSpan={4}>No accounts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
