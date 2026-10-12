import { UserRound } from 'lucide-react'

const GRADIENTS = [
  ['#10b981', '#0ea5e9'],
  ['#6366f1', '#a855f7'],
  ['#f59e0b', '#ef4444'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#22c55e'],
  ['#3b82f6', '#06b6d4'],
  ['#f97316', '#eab308'],
]

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function gradientFor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const [a, b] = GRADIENTS[hash % GRADIENTS.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

export default function Avatar({ src, name, size = 44, className = '' }) {
  const style = { width: size, height: size, fontSize: size * 0.38 }

  if (src) {
    return <img src={src} alt={name ?? ''} className={`avatar ${className}`} style={style} loading="lazy" />
  }

  if (!name) {
    return (
      <div className={`avatar avatar-vacant ${className}`} style={style}>
        <UserRound size={size * 0.5} />
      </div>
    )
  }

  return (
    <div className={`avatar ${className}`} style={{ ...style, background: gradientFor(name) }}>
      {initials(name)}
    </div>
  )
}
