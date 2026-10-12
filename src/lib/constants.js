export const LEVELS = {
  officer: { label: 'Executive Officer', rank: 0 },
  director: { label: 'Director', rank: 1 },
  assistant: { label: 'Asst. Director', rank: 2 },
  member: { label: 'Member', rank: 3 },
}

export const sortPositions = (a, b) =>
  a.sort_order - b.sort_order || LEVELS[a.level].rank - LEVELS[b.level].rank

export function errorMessage(err) {
  return err?.message || 'Something went wrong. Please try again.'
}
