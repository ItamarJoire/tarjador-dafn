import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import styles from './BotaoIcone.module.scss'

interface BotaoIconeProps {
  icone: IconDefinition
  /** Nome do que o botão abre: vira o aria-label e a dica ao passar o mouse. */
  rotulo: string
  onClick: () => void
}

/** Botão só com ícone, no formato do cabeçalho; abre uma janela. */
export const BotaoIcone: React.FC<BotaoIconeProps> = ({ icone, rotulo, onClick }) => (
  <button
    type="button"
    className={styles['botao']}
    onClick={onClick}
    aria-label={rotulo}
    aria-haspopup="dialog"
    title={rotulo}
  >
    <FontAwesomeIcon icon={icone} />
  </button>
)
