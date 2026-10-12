import { useData } from '../context/DataContext'

export default function MemberOptions({ emptyLabel = '— Vacant —' }) {
  const { members, rolesByMember } = useData()
  const free = members.filter((m) => !rolesByMember.has(m.id))
  const taken = members.filter((m) => rolesByMember.has(m.id))

  return (
    <>
      <option value="">{emptyLabel}</option>
      {free.length > 0 && (
        <optgroup label="Unassigned members">
          {free.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </optgroup>
      )}
      {taken.length > 0 && (
        <optgroup label="Already holding a role">
          {taken.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )
}
