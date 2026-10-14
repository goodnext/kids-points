import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { installAudioUnlock } from './ui/sound'
import { StoreProvider } from './ui/store'
import './ui/app.css'

installAudioUnlock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
