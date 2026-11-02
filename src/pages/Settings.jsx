import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Shield, Users } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { STAFF_ACCESS, TRACKER_ACCESS_ROLES, normalizeStaffPermissions, staffPageLabel } from '../lib/accounts'
import { errorMessage } from '../lib/constants'
import { TRACKER_ROLES, memberCode } from '../lib/tracker'
import { useToast } from '../context/ToastContext'

export default function Settings() {
  const { settings, refreshAccess, setupNeeded } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('grant')
  const [roles, setRoles] = useState([])
  const [roster, setRoster] = useState([])
  const [pageMap, setPageMap] = useState({})
  const [accessRows, setAccessRows] = useState([])
  const [query, setQuery] = useState('')
  const [listQuery, setListQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [draftPages, setDraftPages] = useState([])
  const [savingRoles, setSavingRoles] = useState(false)
  const [savingMember, setSavingMember] = useState(false)
  const [loadingList, setLoadingList] = useState(false)

  useEffect(() => {
    setRoles(settings?.tracker_roles || [])
  }, [settings])

  const loadRosterAccess = useCallback(async () => {
    const [{ data: trackerRows }, { data: accessData, error }] = await Promise.all([
      supabase.from('membership_tracker').select('member_no, full_name, tracker_role').order('member_no'),
      supabase.from('staff_page_access').select('member_no, pages'),
    ])
    setRoster((trackerRows || []).filter((row) => row.full_name.trim() || row.member_no === 23))
    if (error?.code === 'PGRST205') {
      setPageMap({})
      return
    }
    const next = {}
    ;(accessData || []).forEach((row) => {
      next[row.member_no] = row.pages || []
    })
    setPageMap(next)
  }, [])

  const loadAccessList = useCallback(async () => {
    setLoadingList(true)
    const { data, error } = await supabase.rpc('list_staff_access')
    setLoadingList(false)
    if (error) {
      if (error.code === 'PGRST202' || error.code === 'PGRST205') {
        setAccessRows([])
        return
      }
      toast.error(errorMessage(error))
      return
    }
    setAccessRows(data || [])
  }, [toast])

  useEffect(() => {
    loadRosterAccess()
    loadAccessList()
  }, [loadRosterAccess, loadAccessList])

  const visibleRoster = useMemo(() => {
    const q = query.trim().toLowerCase()
    return roster.filter((row) => {
      if (!q) return true
      return row.full_name.toLowerCase().includes(q) || memberCode(row.member_no).toLowerCase().includes(q)
    })
  }, [roster, query])

  const visibleAccess = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return accessRows.filter((row) => {
      if (!q) return true
      return (
        row.full_name.toLowerCase().includes(q)
        || row.username.toLowerCase().includes(q)
        || memberCode(row.member_no).toLowerCase().includes(q)
        || (row.pages || []).some((page) => staffPageLabel(page).toLowerCase().includes(q))
      )
    })
  }, [accessRows, listQuery])

  function toggleRole(role) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]))
  }

  function openMember(memberNo) {
    setSelected(memberNo)
    setDraftPages([...(pageMap[memberNo] || [])])
  }

  function togglePage(pageKey) {
    setDraftPages((current) => {
      const page = STAFF_ACCESS.find((item) => item.key === pageKey)
      const on = current.includes(pageKey)
      if (on) {
        const actionKeys = new Set((page?.actions || []).map((action) => action.key))
        return current.filter((item) => item !== pageKey && !actionKeys.has(item))
      }
      return normalizeStaffPermissions([...current, pageKey])
    })
  }

  function toggleAction(actionKey, pageKey) {
    setDraftPages((current) => {
      const on = current.includes(actionKey)
      if (on) return normalizeStaffPermissions(current.filter((item) => item !== actionKey))
      return normalizeStaffPermissions([...current, pageKey, actionKey])
    })
  }

  async function saveRoles(event) {
    event.preventDefault()
    setSavingRoles(true)
    const memberNos = settings?.tracker_member_nos || []
    const { error } = await supabase.rpc('save_tracker_access', { p_roles: roles, p_member_nos: memberNos })
    setSavingRoles(false)
    if (error) {
      toast.error(error.code === 'PGRST202' ? 'Run supabase/accounts.sql in the Supabase SQL Editor first.' : errorMessage(error))
      return
    }
    await refreshAccess()
    toast.success('Role tracker access saved.')
    loadAccessList()
  }

  async function saveMemberPages(event) {
    event.preventDefault()
    if (!selected) return
    const pages = normalizeStaffPermissions(draftPages)
    setSavingMember(true)
    const { error } = await supabase.rpc('save_staff_page_access', {
      p_member_no: selected,
      p_pages: pages,
    })
    setSavingMember(false)
    if (error) {
      toast.error(
        error.code === 'PGRST202'
          ? 'Run supabase/staff-page-access.sql in the Supabase SQL Editor first.'
          : errorMessage(error),
      )
      return
    }
    setDraftPages(pages)
    setPageMap((current) => {
      const next = { ...current }
      if (pages.length) next[selected] = [...pages]
      else delete next[selected]
      return next
    })
    await refreshAccess()
    toast.success(pages.length ? 'Access saved.' : 'Access removed.')
    loadAccessList()
  }

  async function revokeAccess(memberNo) {
    const { error } = await supabase.rpc('save_staff_page_access', {
      p_member_no: memberNo,
      p_pages: [],
    })
    if (error) {
      toast.error(errorMessage(error))
      return
    }
    setPageMap((current) => {
      const next = { ...current }
      delete next[memberNo]
      return next
    })
    if (selected === memberNo) setDraftPages([])
    await refreshAccess()
    toast.success('Access removed.')
    loadAccessList()
  }

  const selectedRow = roster.find((row) => row.member_no === selected) || null
  const grantedCount = Object.keys(pageMap).length

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Settings</h1>
          <p className="muted">
            Offer admin pages and CRUD actions to members, then review who already has access.
          </p>
        </div>
      </header>

      {setupNeeded && (
        <div className="alert">
          Run <code>supabase/staff-page-access.sql</code> last in the Supabase SQL Editor (after enroll-member / registration-form if you re-run those), then refresh.
        </div>
      )}

      <div className="segmented settings-tabs" role="tablist" aria-label="Settings sections">
        <button type="button" className={tab === 'grant' ? 'active' : ''} onClick={() => setTab('grant')} role="tab" aria-selected={tab === 'grant'}>
          <Shield size={16} /> Grant access
        </button>
        <button type="button" className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')} role="tab" aria-selected={tab === 'list'}>
          <Users size={16} /> Access list ({accessRows.length || grantedCount})
        </button>
      </div>

      {tab === 'grant' ? (
        <div className="settings-grid">
          <form className="panel form" onSubmit={saveRoles}>
            <fieldset className="choice-set">
              <legend>Roles that can open Tracker</legend>
              <p className="muted small">Whole roles get Tracker view only. Use the member panel to offer edit rights or other pages.</p>
              <div className="check-row">
                {TRACKER_ACCESS_ROLES.map((role) => (
                  <label key={role} className="check">
                    <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                    <span>{TRACKER_ROLES.find((item) => item.value === role)?.label || role}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn btn-primary" disabled={savingRoles}>
              {savingRoles ? 'Saving…' : 'Save role access'}
            </button>
          </form>

          <section className="panel settings-member-access">
            <div className="settings-member-head">
              <div>
                <h2>Pages and CRUD for a member</h2>
                <p className="muted small">Pick a member, choose pages and Add / Edit / Delete (or manage) actions, then save.</p>
              </div>
              <div className="search">
                <Search size={17} />
                <input placeholder="Search name or ID" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
            </div>

            <div className="settings-member-split">
              <div className="settings-member-list" role="listbox" aria-label="Members">
                {visibleRoster.map((row) => {
                  const pages = pageMap[row.member_no] || []
                  const active = selected === row.member_no
                  return (
                    <button
                      key={row.member_no}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`settings-member-row${active ? ' active' : ''}`}
                      onClick={() => openMember(row.member_no)}
                    >
                      <span>
                        <strong>{memberCode(row.member_no)}</strong>
                        <span>{row.full_name.trim() || 'No name yet'}</span>
                      </span>
                      {pages.length ? <em>{pages.length} right{pages.length === 1 ? '' : 's'}</em> : <em className="muted">No access</em>}
                    </button>
                  )
                })}
              </div>

              <form className="settings-page-picker form" onSubmit={saveMemberPages}>
                {selectedRow ? (
                  <>
                    <div>
                      <p className="eyebrow">Selected</p>
                      <h3>
                        {memberCode(selectedRow.member_no)} · {selectedRow.full_name.trim() || 'No name yet'}
                      </h3>
                    </div>
                    <div className="settings-access-groups">
                      {STAFF_ACCESS.map((page) => (
                        <fieldset key={page.key} className="settings-access-group">
                          <legend>
                            {page.nav !== false ? (
                              <label className="check">
                                <input type="checkbox" checked={draftPages.includes(page.key)} onChange={() => togglePage(page.key)} />
                                <span>{page.label}</span>
                              </label>
                            ) : (
                              <span>{page.label}</span>
                            )}
                          </legend>
                          {page.note ? <p className="muted small">{page.note}</p> : null}
                          {page.actions.length ? (
                            <div className="check-row settings-action-row">
                              {page.actions.map((action) => (
                                <label key={action.key} className="check">
                                  <input
                                    type="checkbox"
                                    checked={draftPages.includes(action.key)}
                                    onChange={() => toggleAction(action.key, page.key)}
                                  />
                                  <span>{action.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="muted small">View only</p>
                          )}
                        </fieldset>
                      ))}
                    </div>
                    <div className="settings-page-actions">
                      <button type="button" className="btn btn-ghost" disabled={savingMember || !draftPages.length} onClick={() => setDraftPages([])}>
                        Clear all
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={savingMember}>
                        {savingMember ? 'Saving…' : 'Save access'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="settings-empty">
                    <p>Select a member on the left to offer pages and CRUD actions.</p>
                  </div>
                )}
              </form>
            </div>
          </section>
        </div>
      ) : (
        <section className="panel">
          <div className="settings-member-head">
            <div>
              <h2>Users with access</h2>
              <p className="muted small">Everyone with at least one admin page or CRUD right, and what they can do.</p>
            </div>
            <div className="search">
              <Search size={17} />
              <input placeholder="Search users or permissions" value={listQuery} onChange={(event) => setListQuery(event.target.value)} />
            </div>
          </div>

          {loadingList ? (
            <p className="muted">Loading access list…</p>
          ) : visibleAccess.length === 0 ? (
            <div className="settings-empty">
              <p>No members have admin-side access yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table access-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Username</th>
                    <th>Access</th>
                    <th>Source</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleAccess.map((row) => (
                    <tr key={row.member_no}>
                      <td>
                        <strong>{memberCode(row.member_no)}</strong>
                        <div className="muted small">{row.full_name || '—'}</div>
                      </td>
                      <td>{row.username}</td>
                      <td>
                        <div className="access-chips">
                          {(row.pages || []).map((page) => (
                            <span key={page} className="access-chip">
                              {staffPageLabel(page)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="access-source">
                          {row.via_direct ? <span className="badge">Direct</span> : null}
                          {row.via_role ? <span className="badge badge-muted">Role</span> : null}
                        </div>
                      </td>
                      <td className="access-row-actions">
                        <button
                          type="button"
                          className="btn btn-soft btn-sm"
                          onClick={() => {
                            setTab('grant')
                            openMember(row.member_no)
                          }}
                        >
                          Edit
                        </button>
                        {row.via_direct ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => revokeAccess(row.member_no)}>
                            Revoke
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
