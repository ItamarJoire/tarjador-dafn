import React from 'react'
import { Badge } from '../../../ui'
import { frase } from '../agruparPorPagina'
import type { ListaPendenciasProps } from './types'
import styles from './ListaPendencias.module.scss'

/** Alertas da página e tarjas com dúvida, com o motivo de cada uma. */
// "SC*****************************************te" -> "SC•••••te"
const encurtarMascara = (valor: string) => valor.replace(/\*{6,}/g, '•••••')

export const ListaPendencias: React.FC<ListaPendenciasProps> = ({ item, className = '' }) => (
  <div className={`${styles['pendencias']}${className ? ` ${className}` : ''}`}>
    {item.alertas.map(alerta => (
      <p key={alerta} className={styles['alerta']}>
        <Badge variant="danger">Alerta</Badge>
        <span>{frase(alerta)}</span>
      </p>
    ))}

    {item.tarjas.length > 0 && (
      <ul className={styles['tarjas']}>
        {item.tarjas.map(tarja => (
          <li key={tarja.id} className={styles['tarja']}>
            <div className={styles['tarja-linha']}>
              <Badge variant="warning">{tarja.tipo}</Badge>
              <span className={styles['tarja-valor']} title="Valor mascarado">
                {encurtarMascara(tarja.valor)}
              </span>
            </div>
            <span className={styles['tarja-motivo']}>{frase(tarja.motivo)}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
)
