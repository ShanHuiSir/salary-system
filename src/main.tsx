import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cleanupAppReloadParam, reloadAppForUpdatedAssets } from './utils/appReload'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadAppForUpdatedAssets()
})

cleanupAppReloadParam()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
