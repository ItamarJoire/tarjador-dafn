import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { Button, Loading, Message } from '../../../ui'
import { Modal } from '../../../ui/Modal'
import type { ConfirmarDownloadProps } from './types'
import styles from './ConfirmarDownload.module.scss'

/**
 * Ao baixar o PDF tarjado: baixar e concluir (sai dos tarjamentos e fica no
 * histórico) ou só baixar (continua nos tarjamentos).
 */
export const ConfirmarDownload: React.FC<ConfirmarDownloadProps> = ({
  nomeArquivo,
  baixando,
  erro,
  onSoBaixar,
  onConcluir,
  onFechar,
  exemplo = false
}) => (
  <Modal
    open={nomeArquivo !== null}
    onClose={baixando ? () => undefined : onFechar}
    title="Baixar PDF tarjado"
    size="medium"
    closeOnOverlayClick={false}
    footer={
      <div className={styles['acoes']} data-tour={exemplo ? 'download-opcoes' : undefined}>
        {baixando && <Loading size="small" label="Baixando ..." />}
        <Button variant="tertiary" onClick={onFechar} disabled={baixando}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={onSoBaixar} disabled={baixando}>
          Só baixar
        </Button>
        <Button icon={<FontAwesomeIcon icon={faDownload} />} onClick={onConcluir} disabled={baixando}>
          Baixar e concluir
        </Button>
      </div>
    }
  >
    <div className={styles['texto']}>
      <p>
        <strong>{nomeArquivo}</strong>
      </p>
      <p>
        <strong>Baixar e concluir</strong> tira o arquivo dos tarjamentos e o registra no histórico de tarjamentos
        concluídos. Quando todos os arquivos de um lote são concluídos, os PDFs dele são apagados do servidor.
      </p>
      <p>
        <strong>Só baixar</strong> mantém o arquivo nos tarjamentos, para conferir ou baixar de novo.
      </p>
      {erro && <Message variant="error">{erro}</Message>}
    </div>
  </Modal>
)
