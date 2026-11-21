import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye } from '@fortawesome/free-solid-svg-icons'
import { Badge, Button } from '../../../ui'
import { Checkbox } from '../../../ui/Checkbox'
import { frase } from '../agruparPorPagina'
import type { PendenciasArquivoProps } from './types'
import styles from './PendenciasArquivo.module.scss'

// "SC*****************************************te" -> "SC•••••te"
const encurtarMascara = (valor: string) => valor.replace(/\*{6,}/g, '•••••')

/**
 * Uma linha por página: o número, o que conferir ali (alertas da página e
 * tarjas com dúvida, cada uma com o motivo), o check de aprovada (controle da
 * conferência) e o botão para ver a página.
 */
export const PendenciasArquivo: React.FC<PendenciasArquivoProps> = ({ paginas, aprovadas, onAprovar, onVer }) => (
  <ul className={styles['lista']}>
    {paginas.map(item => {
      const aprovada = aprovadas.includes(item.pagina)
      return (
        <li key={item.pagina} className={`${styles['linha']}${aprovada ? ` ${styles['aprovada']}` : ''}`}>
          <span className={styles['pagina']}>Pág. {item.pagina}</span>

          <div className={styles['itens']}>
            {item.alertas.map(alerta => (
              <div key={alerta} className={styles['item']}>
                <Badge variant="danger">Alerta</Badge>
                <span className={styles['motivo']}>{frase(alerta)}</span>
              </div>
            ))}
            {item.tarjas.map(tarja => (
              <div key={tarja.id} className={styles['item']}>
                <Badge variant="warning">{tarja.tipo}</Badge>
                <span className={styles['motivo']}>
                  {frase(tarja.motivo)}{' '}
                  <span className={styles['valor']} title="Valor mascarado">
                    {encurtarMascara(tarja.valor)}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className={styles['acoes']}>
            <Checkbox label="Aprovada" checked={aprovada} onChange={marcar => onAprovar(item.pagina, marcar)} />
            <Button
              variant="tertiary"
              icon={<FontAwesomeIcon icon={faEye} />}
              ariaLabel={`Ver página ${item.pagina}`}
              onClick={() => onVer(item.pagina)}
            >
              Ver página
            </Button>
          </div>
        </li>
      )
    })}
  </ul>
)
