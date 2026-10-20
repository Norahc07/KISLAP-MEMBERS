import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

const RING = 2 * Math.PI * 52

function runningInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function assetUrls(html) {
  const found = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1])
  return [...new Set([
    '/manifest.webmanifest',
    '/sw.js',
    '/KISLAP-LOGO.png',
    '/icon-192.png',
    ...found.filter((url) => url.startsWith('/assets/') || url.endsWith('.png')),
  ])]
}

async function readBody(response, onBytes) {
  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = await response.arrayBuffer()
    onBytes(buffer.byteLength, buffer.byteLength)
    return buffer.byteLength
  }
  const declared = Number(response.headers.get('content-length')) || 0
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    onBytes(received, declared || received)
  }
  return received
}

async function cacheShell(onRatio) {
  const index = await fetch('/')
  const html = index.ok ? await index.text() : ''
  const urls = assetUrls(html)
  const loaded = new Array(urls.length + 1).fill(0)
  const totals = new Array(urls.length + 1).fill(0)
  loaded[0] = new TextEncoder().encode(html).byteLength
  totals[0] = loaded[0] || 1

  function report() {
    const sumLoaded = loaded.reduce((sum, value) => sum + value, 0)
    const sumTotal = totals.reduce((sum, value) => sum + value, 0)
    onRatio(sumTotal ? Math.min(1, sumLoaded / sumTotal) : 0)
  }

  report()
  await Promise.all(urls.map(async (url, index) => {
    const slot = index + 1
    try {
      const response = await fetch(url)
      if (!response.ok) {
        loaded[slot] = 1
        totals[slot] = 1
        report()
        return
      }
      const size = await readBody(response, (received, total) => {
        loaded[slot] = received
        totals[slot] = total
        report()
      })
      loaded[slot] = size
      totals[slot] = size || 1
      report()
    } catch {
      loaded[slot] = 1
      totals[slot] = 1
      report()
    }
  }))
  onRatio(1)
}

function waitForInstalled(ms) {
  if (localStorage.getItem('kislap-installed') === '1') return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = window.setTimeout(finish, ms)
    function finish() {
      window.removeEventListener('kislap-installed', finish)
      window.clearTimeout(timer)
      resolve(localStorage.getItem('kislap-installed') === '1')
    }
    window.addEventListener('kislap-installed', finish)
  })
}

export default function Landing() {
  const navigate = useNavigate()
  const { session, ready } = useAuth()
  const [installable, setInstallable] = useState(() => Boolean(window.deferredInstall))
  const [installed, setInstalled] = useState(() => localStorage.getItem('kislap-installed') === '1')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    const previous = document.title
    document.title = 'KISLAP'
    return () => {
      document.title = previous
    }
  }, [])

  useEffect(() => {
    if (!ready || !runningInstalled()) return
    navigate(session ? '/' : '/login', { replace: true })
  }, [ready, session, navigate])

  useEffect(() => {
    function onInstallable() {
      localStorage.removeItem('kislap-installed')
      setInstalled(false)
      setInstallable(true)
    }
    function onInstalled() {
      setInstalled(true)
      setInstallable(false)
    }
    window.addEventListener('kislap-installable', onInstallable)
    window.addEventListener('kislap-installed', onInstalled)
    return () => {
      window.removeEventListener('kislap-installable', onInstallable)
      window.removeEventListener('kislap-installed', onInstalled)
    }
  }, [])

  function openApp() {
    navigate(session ? '/' : '/login')
  }

  async function install() {
    const promptEvent = window.deferredInstall
    if (!promptEvent) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      setNote(ios
        ? 'Tap Share, then Add to Home Screen. The icon is the KISLAP logo and the name is KISLAP.'
        : 'Use the install icon in the address bar. When KISLAP is on your device, this page shows Open.')
      return
    }

    setBusy(true)
    setNote('')
    setProgress(0)
    setLabel('Confirm the install')
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      window.deferredInstall = null
      setInstallable(false)
      if (choice.outcome !== 'accepted') {
        setBusy(false)
        setProgress(0)
        setLabel('')
        setNote('Install was cancelled.')
        return
      }

      setLabel('Downloading KISLAP')
      await cacheShell((ratio) => {
        const percent = Math.round(ratio * 100)
        setProgress(percent)
        setLabel(percent >= 100 ? 'Finishing install' : 'Downloading KISLAP')
      })
      setLabel('Finishing install')
      await waitForInstalled(2500)
      localStorage.setItem('kislap-installed', '1')
      setProgress(100)
      setLabel('Ready to open')
      setInstalled(true)
    } catch {
      setNote('The browser could not start the install. Try the install icon in the address bar.')
      setProgress(0)
      setLabel('')
    } finally {
      setBusy(false)
    }
  }

  const showOpen = installed && !busy
  const showMeter = busy || (installed && progress === 100)

  return (
    <div className="login-page">
      <div className="login-bg" />
      <section className="login-card landing-card">
        <Logo size={128} />
        <div>
          <h1 className="landing-name">KISLAP</h1>
          <p className="muted">Youth Volunteers</p>
        </div>

        {showMeter && (
          <div className="install-block" aria-live="polite">
            <div className="install-meter">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="install-ring-track" cx="60" cy="60" r="52" />
                <circle
                  className="install-ring-value"
                  cx="60"
                  cy="60"
                  r="52"
                  strokeDasharray={RING}
                  strokeDashoffset={RING - (RING * progress) / 100}
                />
              </svg>
              <strong>{progress}%</strong>
            </div>
            <div className="install-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={label}>
              <div className="install-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="install-label">{label}</p>
          </div>
        )}

        <div className="landing-actions">
          {showOpen ? (
            <button type="button" className="btn btn-primary btn-block" onClick={openApp}>
              Open
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={install} disabled={busy || !ready}>
              {busy ? 'Downloading…' : 'Download the app'}
            </button>
          )}
          {!busy && (
            <button type="button" className="btn btn-soft btn-block" onClick={openApp}>
              Use the web
            </button>
          )}
        </div>

        <p className="landing-note">
          {note || 'Use the web if you do not want to download the app.'}
        </p>
      </section>
    </div>
  )
}
