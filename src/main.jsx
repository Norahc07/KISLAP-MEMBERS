import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'

window.deferredInstall = null
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.deferredInstall = event
  window.dispatchEvent(new Event('kislap-installable'))
})
window.addEventListener('appinstalled', () => {
  window.deferredInstall = null
  localStorage.setItem('kislap-installed', '1')
  window.dispatchEvent(new Event('kislap-installed'))
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
