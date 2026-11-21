import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.scss'
import { App } from './App.tsx'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import { LotesProvider, ThemeProvider } from './contexts/index.ts'
import { TutorialProvider } from './components/Tutorial'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <LotesProvider>
            <TutorialProvider>
              <App />
            </TutorialProvider>
          </LotesProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
)
