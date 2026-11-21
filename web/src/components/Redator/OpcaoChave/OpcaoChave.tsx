import React, { useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { Switch } from '../../../ui/Switch'
import type { OpcaoChaveProps } from './types'
import styles from './OpcaoChave.module.scss'

/**
 * Chave liga/desliga com o título ao lado e um ícone de informação. A
 * explicação aparece num balão ao passar o mouse, focar pelo teclado ou tocar.
 */
export const OpcaoChave: React.FC<OpcaoChaveProps> = ({ titulo, ajuda, checked, onChange, disabled = false }) => {
  const id = useId()
  const idAjuda = useId()
  // Toque (sem hover): o clique fixa o balão aberto até sair do ícone
  const [fixo, setFixo] = useState(false)

  return (
    <div className={`${styles['opcao']}${disabled ? ` ${styles['desabilitada']}` : ''}`}>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} />
      <label htmlFor={id} className={styles['titulo']}>
        {titulo}
      </label>
      <span className={styles['info']}>
        <button
          type="button"
          className={styles['info-botao']}
          aria-label={`O que é "${titulo}"`}
          aria-describedby={idAjuda}
          onClick={() => setFixo(f => !f)}
          onBlur={() => setFixo(false)}
        >
          <FontAwesomeIcon icon={faCircleInfo} />
        </button>
        <span id={idAjuda} role="tooltip" className={`${styles['balao']}${fixo ? ` ${styles['balao-fixo']}` : ''}`}>
          {ajuda}
        </span>
      </span>
    </div>
  )
}
