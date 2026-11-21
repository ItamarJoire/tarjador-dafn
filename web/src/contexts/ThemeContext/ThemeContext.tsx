import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from './context'
import { CHAVES, migrarChaveAntiga, preferencias } from '../../services/armazenamento'
import type { Theme } from './types'

function getInitialTheme(): Theme {
  // 'theme' era a chave antiga, sem prefixo: aproveita a escolha de quem já usava.
  const storedTheme = preferencias.ler(CHAVES.tema) ?? migrarChaveAntiga('theme')
  return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    preferencias.gravar(CHAVES.tema, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(previous => (previous === 'light' ? 'dark' : 'light'))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
