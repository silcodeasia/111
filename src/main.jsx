import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { theme } from './theme'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { BRAND, BRAND_INITIAL } from './lib/brand'

document.title = `${BRAND} · HR-панель`

// favicon с инициалом бренда (Т для Toimart, Y для YourRetail и т.п.)
const favSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="14" fill="#E53935"/>` +
  `<text x="32" y="45" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#ffffff" text-anchor="middle">${BRAND_INITIAL}</text></svg>`
const favLink = document.querySelector("link[rel='icon']")
  || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }))
favLink.type = 'image/svg+xml'
favLink.href = 'data:image/svg+xml,' + encodeURIComponent(favSvg)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
