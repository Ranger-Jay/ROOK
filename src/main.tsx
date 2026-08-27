import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/global.css'
import './harness/live-evidence.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('ROOK root element was not found.')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
