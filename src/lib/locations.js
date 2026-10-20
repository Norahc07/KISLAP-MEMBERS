const BASE = 'https://psgc.cloud/api/v2'
const cache = new Map()

export const METRO_MANILA = { code: '1300000000', name: 'Metro Manila', kind: 'region' }

async function getList(path) {
  if (!cache.has(path)) {
    const pending = fetch(`${BASE}${path}`).then(async (response) => {
      if (!response.ok) throw new Error('Location list is unavailable')
      const body = await response.json()
      return Array.isArray(body.data) ? body.data : []
    })
    cache.set(path, pending)
    pending.catch(() => cache.delete(path))
  }
  return cache.get(path)
}

function repairName(name) {
  if (!/[\u00c0-\u00ff]/.test(name)) return name
  try {
    const bytes = Uint8Array.from(name, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return name
  }
}

function byName(rows) {
  return [...rows]
    .map((row) => ({ ...row, name: repairName(row.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

export function loadProvinces() {
  return getList('/provinces').then((rows) =>
    byName([...rows.map((row) => ({ code: row.code, name: row.name, kind: 'province' })), METRO_MANILA]),
  )
}

export function loadCities(place) {
  const path =
    place.kind === 'region'
      ? `/regions/${place.code}/cities-municipalities`
      : `/provinces/${place.code}/cities-municipalities`
  return getList(path).then((rows) => byName(rows.map((row) => ({ code: row.code, name: row.name }))))
}

export function loadBarangays(cityCode) {
  return getList(`/cities-municipalities/${cityCode}/barangays`).then((rows) =>
    byName(rows.map((row) => ({ code: row.code, name: row.name }))),
  )
}
