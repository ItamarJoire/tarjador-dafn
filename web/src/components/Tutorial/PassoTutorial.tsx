import React, { type ReactNode } from 'react'
import styles from './Tutorial.module.scss'

interface PassoTutorialProps {
  titulo: string
  children: ReactNode
  onSair: () => void
}

/**
 * Conteúdo de um passo do tutorial: título, explicação e o link para sair.
 * A etapa ("3/10") fica na bolha azul do canto (badgeContent do TutorialProvider).
 */
export const PassoTutorial: React.FC<PassoTutorialProps> = ({ titulo, children, onSair }) => (
  <div className={styles['passo']}>
    <h2 className={styles['titulo']}>{titulo}</h2>
    <div className={styles['texto']}>{children}</div>
    <button type="button" className={styles['sair']} onClick={onSair}>
      Sair do tutorial
    </button>
  </div>
)
