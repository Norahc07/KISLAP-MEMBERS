import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { TRACKER_ACCESS_ROLES } from '../lib/accounts'
import { errorMessage } from '../lib/constants'
import { TRACKER_ROLES, memberCode } from '../lib/tracker'
import { useToast } from '../context/ToastContext'

export default function Settings() {
  const { settings, refreshAccess, setupNeeded } = useAuth()
  const toast = useToast()
  const [roles, setRoles] = useState([])
  const [memberNos, setMemberNos] = useState([])
  const [roster, setRoster] = useState([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRoles(settings?.tracker_roles || [])
    setMemberNos(settings?.tracker_member_nos || [])
  }, [settings])

  useEffect(() => {
    supabase
      .from('membership_tracker')
      .select('member_no, full_name, tracker_role')
      .order('member_no')
      .then(({ data }) => setRoster((data || []).filter((row) => row.full_name.trim() || row.member_no === 23)))
  }, [])

  const visibleRoster = useMemo(() => {
    const q = query.trim().toLowerCase()
    return roster.filter((row) => {
      if (!q) return true
      return row.full_name.toLowerCase().includes(q) || memberCode(row.member_no).toLowerCase().includes(q)
    })
  }, [roster, query])

  function toggleRole(role) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]))
  }

  function toggleMember(memberNo) {
    setMemberNos((current) => (current.includes(memberNo) ? current.filter((item) => item !== memberNo) : [...current, memberNo]))
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    const { error } = await supabase.rpc('save_tracker_access', { p_roles: roles, p_member_nos: memberNos })
    setSaving(false)
    if (error) {
      toast.error(error.code === 'PGRST202' ? 'Run supabase/accounts.sql in the Supabase SQL Editor first.' : errorMessage(error))
      return
    }
    await refreshAccess()
    toast.success('Tracker access saved.')
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Settings</h1>
          <p className="muted">Choose which roles and which members can open the membership tracker. The admin can always open it.</p>
        </div>
      </header>

      {setupNeeded && (
        <div className="alert">Run <code>supabase/accounts.sql</code> in the Supabase SQL Editor, then refresh this page.</div>
      )}

      <form className="panel form" onSubmit={save}>
        <fieldset className="choice-set">
          <legend>Roles that can open the tracker</legend>
          <div className="check-row">
            {TRACKER_ACCESS_ROLES.map((role) => (
              <label key={role} className="check">
                <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                <span>{TRACKER_ROLES.find((item) => item.value === role)?.label || role}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Members who can open the tracker</span>
          <input className="input" placeholder="Search a member name or ID" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="check-list">
          {visibleRoster.map((row) => (
            <label key={row.member_no} className="check">
              <input type="checkbox" checked={memberNos.includes(row.member_no)} onChange={() => toggleMember(row.member_no)} />
              <span>
                <strong>{memberCode(row.member_no)}</strong> {row.full_name.trim() || 'No name yet'}
              </span>
            </label>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save tracker access'}
        </button>
      </form>
    </div>
  )
}
