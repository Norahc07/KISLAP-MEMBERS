import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'
import { fetchAll } from '../lib/api'
import { sortPositions } from '../lib/constants'
import { tallyRoster } from '../lib/roster'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { isAdmin } = useAuth()
  const [data, setData] = useState({ members: [], units: [], positions: [], tracker: [], profiles: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  const reload = useCallback(async () => {
    try {
      const org = await fetchAll()
      const tracker = await supabase
        .from('membership_tracker')
        .select('member_no, member_id, full_name, registration_form')
      const profiles = isAdmin
        ? await supabase.from('profiles').select('id, username, member_no, role, full_name')
        : { data: [] }
      setData({
        ...org,
        tracker: tracker.error ? [] : tracker.data || [],
        profiles: profiles.error ? [] : profiles.data || [],
      })
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    reload()
    const scheduleReload = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(reload, 250)
    }
    const channel = supabase
      .channel('org-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_tracker' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleReload)
      .subscribe()
    return () => {
      clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [reload])

  const derived = useMemo(() => {
    const membersById = new Map(data.members.map((m) => [m.id, m]))
    const unitsById = new Map(data.units.map((u) => [u.id, u]))
    const positionsByUnit = new Map(data.units.map((u) => [u.id, []]))
    const rolesByMember = new Map()

    for (const p of [...data.positions].sort(sortPositions)) {
      positionsByUnit.get(p.unit_id)?.push(p)
      if (p.member_id) {
        const list = rolesByMember.get(p.member_id) ?? []
        list.push({ position: p, unit: unitsById.get(p.unit_id) })
        rolesByMember.set(p.member_id, list)
      }
    }

    const filled = data.positions.filter((p) => p.member_id).length
    const adviserIds = data.positions.filter((position) => position.level === 'adviser').map((position) => position.member_id)
    const roster = tallyRoster({ members: data.members, tracker: data.tracker, profiles: data.profiles, adviserIds })
    return {
      membersById,
      unitsById,
      positionsByUnit,
      rolesByMember,
      roster,
      stats: {
        members: roster.members,
        directory: data.members.length,
        positions: data.positions.length,
        filled,
        vacant: data.positions.length - filled,
        unassigned: data.members.filter((m) => !rolesByMember.has(m.id)).length,
        users: roster.users,
        withId: roster.withId,
        withoutId: roster.withoutId,
        submitted: roster.submitted,
      },
    }
  }, [data])

  const value = { ...data, ...derived, loading, error, reload }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
