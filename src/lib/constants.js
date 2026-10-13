export const LEVELS = {
  adviser: { label: 'Adviser', rank: -1 },
  officer: { label: 'Executive Officer', rank: 0 },
  director: { label: 'Director', rank: 1 },
  assistant: { label: 'Asst. Director', rank: 2 },
  member: { label: 'Member', rank: 3 },
}

const rankOf = (level) => LEVELS[level]?.rank ?? 99

export const sortPositions = (a, b) => rankOf(a.level) - rankOf(b.level) || a.sort_order - b.sort_order

export function errorMessage(err) {
  return err?.message || 'Something went wrong. Please try again.'
}
