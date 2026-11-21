import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Button, Message } from '../../../ui'
import { Modal } from '../../../ui/Modal'
import { plural } from '../agruparPorPagina'
import type { ConfirmarExclusaoProps, ModoExclusao } from './types'
import styles from './ConfirmarExclusao.module.scss'

const TEXTOS: Record<ModoExclusao, { titulo: string; manter: string; confirmar: string; emCurso: string }> = {
  cancelar: {
    titulo: 'Cancelar o tarjamento?',
    manter: 'Continuar tarjando',
    confirmar: 'Cancelar e apagar',
    emCurso: 'Cancelando ...'
  },
  apagar: {
    titulo: 'Apagar este lote?',
    manter: 'Manter',
    confirmar: 'Apagar lote',
    emCurso: 'Apagando ...'
  }
}

const avisoTarjados = (n: number) =>
  n === 1
    ? 'O arquivo que já foi tarjado também será apagado.'
    : `Os ${plural(n, 'arquivo', 'arquivos')} que já foram tarjados também serão apagados.`

export const ConfirmarExclusao: React.FC<ConfirmarExclusaoProps> = ({
  open,
  modo,
  jaTarjados,
  apagando,
  erro,
  onConfirmar,
  onFechar
}) => {
  const texto = TEXTOS[modo]

  return (
    <Modal
      open={open}
      onClose={apagando ? () => undefined : onFechar}
      size="medium"
      closeOnOverlayClick={false}
      className={styles['perigo']}
      title={
        <span className={styles['titulo']}>
          <FontAwesomeIcon icon={faTriangleExclamation} className={styles['icone']} />
          {texto.titulo}
        </span>
      }
      footer={
        <div className={styles['acoes']}>
          <Button variant="secondary" onClick={onFechar} disabled={apagando}>
            {texto.manter}
          </Button>
          <Button
            variant="danger"
            icon={<FontAwesomeIcon icon={modo === 'cancelar' ? faXmark : faTrashCan} />}
            onClick={onConfirmar}
            disabled={apagando}
          >
            {apagando ? texto.emCurso : texto.confirmar}
          </Button>
        </div>
      }
    >
      <div className={styles['texto']}>
        {modo === 'cancelar' ? (
          <>
            <p>O processamento para agora e os PDFs enviados são apagados.</p>
            {jaTarjados > 0 && (
              <p>
                <strong>{avisoTarjados(jaTarjados)}</strong> Baixe antes o que precisar.
              </p>
            )}
          </>
        ) : (
          <p>
            <strong>Os PDFs tarjados deste lote serão apagados.</strong> Baixe antes o que precisar.
          </p>
        )}
        <p>Não é possível desfazer.</p>
        {erro && <Message variant="error">{erro}</Message>}
      </div>
    </Modal>
  )
}
