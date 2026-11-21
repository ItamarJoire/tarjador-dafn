import { useState } from 'react'
import { Cabecalho } from './components/Cabecalho'
import { Rodape } from './components/Rodape'
import { AreaLateralContext } from './contexts/AreaLateral'
import styles from './App.module.scss'
import { AppRoutes } from './routes'

export const App = () => {
  // Faixa à direita do conteúdo, entre cabeçalho e rodapé: a sidebar de
  // tarjamentos é encaixada aqui (por portal), e não por cima da página.
  const [areaLateral, setAreaLateral] = useState<HTMLDivElement | null>(null)

  return (
    <AreaLateralContext.Provider value={areaLateral}>
      <div className={styles['app']}>
        <Cabecalho />
        <div className={styles['corpo']}>
          <main className={styles['conteudo']}>
            <AppRoutes />
          </main>
          <div ref={setAreaLateral} className={styles['lateral']} />
        </div>
        <Rodape />
      </div>
    </AreaLateralContext.Provider>
  )
}
