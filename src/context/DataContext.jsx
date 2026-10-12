import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAll } from '../lib/api'
import { sortPositions } from '../lib/constants'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [data, setData] = useState({ members: [], units: [], positions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  const reload = useCallback(async () => {
    try {
      setData(await fetchAll())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

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
    return {
      membersById,
      unitsById,
      positionsByUnit,
      rolesByMember,
      stats: {
        members: data.members.length,
        positions: data.positions.length,
        filled,
        vacant: data.positions.length - filled,
        unassigned: data.members.filter((m) => !rolesByMember.has(m.id)).length,
      },
    }
  }, [data])

  const value = { ...data, ...derived, loading, error, reload }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
