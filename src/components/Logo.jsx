import { useState } from 'react'

export default function Logo({ size = 44 }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="logo-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        K
      </div>
    )
  }

  return (
    <img
      src="/KISLAP-LOGO.png"
      alt="KISLAP logo"
      className="logo-img"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  )
}
