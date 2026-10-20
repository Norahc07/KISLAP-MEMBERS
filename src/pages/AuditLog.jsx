import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { errorMessage } from '../lib/constants'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 15

export default function AuditLog() {
  const { setupNeeded } = useAuth()
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(({ data, error: queryError, count: total }) => {
        if (ignore) return
        if (queryError) setError(queryError.code === 'PGRST205' ? 'missing' : errorMessage(queryError))
        else {
          setRows(data || [])
          setCount(total || 0)
          setError('')
        }
        setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [page])

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Audit log</h1>
          <p className="muted">{count} recorded actions. Newest entries are first.</p>
        </div>
      </header>

      {(setupNeeded || error === 'missing') && (
        <div className="alert">Run <code>supabase/accounts.sql</code> in the Supabase SQL Editor, then refresh this page.</div>
      )}
      {error && error !== 'missing' && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Account</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>Loading the log…</td>
              </tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>{row.actor_username || '—'}</td>
                <td>{row.action.replaceAll('_', ' ')}</td>
                <td>{row.summary}</td>
              </tr>
            ))}
            {!loading && !rows.length && !error && (
              <tr>
                <td colSpan={4}>No actions have been recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>
          Previous
        </button>
        <span>Page {page + 1} of {pages}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page + 1 >= pages} onClick={() => setPage((current) => current + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
