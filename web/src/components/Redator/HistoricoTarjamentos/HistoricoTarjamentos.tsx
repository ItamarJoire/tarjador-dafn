import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { Button } from '../../../ui'
import { Modal } from '../../../ui/Modal'
import { useLotes } from '../../../contexts'
import { plural } from '../agruparPorPagina'
import styles from './HistoricoTarjamentos.module.scss'

const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Até 3 tipos por extenso; o resto vira "+N". */
const resumoTipos = (tipos: string[]) =>
  tipos.length <= 3 ? tipos.join(', ') : `${tipos.slice(0, 3).join(', ')} +${tipos.length - 3}`

/**
 * Histórico dos tarjamentos concluídos (baixados com "Baixar e concluir"),
 * abaixo do cartão de envio. Fica no navegador entre visitas, até limpar.
 */
export const HistoricoTarjamentos: React.FC = () => {
  const { historico, limparHistorico } = useLotes()
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)

  if (historico.length === 0) return null

  return (
    <section className={styles['historico']} aria-labelledby="titulo-historico" data-tour="historico">
      <div className={styles['topo']}>
        <div className={styles['topo-textos']}>
          <h2 id="titulo-historico" className={styles['titulo']}>
            Tarjamentos concluídos
          </h2>
          <span className={styles['contagem']}>{plural(historico.length, 'arquivo', 'arquivos')}</span>
        </div>
        <button type="button" className={styles['limpar']} onClick={() => setConfirmandoLimpeza(true)}>
          <FontAwesomeIcon icon={faTrashCan} />
          <span>Limpar lista</span>
        </button>
      </div>

      <ul className={styles['lista']}>
        {historico.map(entrada => (
          <li key={entrada.id} className={styles['item']}>
            <FontAwesomeIcon icon={faCircleCheck} className={styles['icone']} />
            <div className={styles['item-textos']}>
              <span className={styles['nome']}>{entrada.nome}</span>
              <span className={styles['detalhes']}>
                {plural(entrada.paginas, 'página', 'páginas')} ·{' '}
                {plural(entrada.tarjas, 'tarja', 'tarjas')}
                {entrada.tipos.length > 0 && ` · ${resumoTipos(entrada.tipos)}`}
              </span>
            </div>
            <time className={styles['data']} dateTime={entrada.concluidoEm}>
              {formatoData.format(new Date(entrada.concluidoEm))}
            </time>
          </li>
        ))}
      </ul>

      <Modal
        open={confirmandoLimpeza}
        onClose={() => setConfirmandoLimpeza(false)}
        title="Limpar a lista?"
        size="small"
        footer={
          <div className={styles['modal-acoes']}>
            <Button variant="secondary" onClick={() => setConfirmandoLimpeza(false)}>
              Manter
            </Button>
            <Button
              variant="danger"
              icon={<FontAwesomeIcon icon={faTrashCan} />}
              onClick={() => {
                limparHistorico()
                setConfirmandoLimpeza(false)
              }}
            >
              Limpar lista
            </Button>
          </div>
        }
      >
        <p className={styles['modal-texto']}>
          O registro dos {plural(historico.length, 'tarjamento concluído', 'tarjamentos concluídos')} sai desta lista.
          Os PDFs que você já baixou não são afetados.
        </p>
      </Modal>
    </section>
  )
}
