import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeadset } from '@fortawesome/free-solid-svg-icons'
import { Modal } from '../../ui/Modal'
import { EQUIPE } from '../../services/ambiente'
import { ListaContatos } from './ListaContatos'
import styles from './Equipe.module.scss'

/** Link do rodapé: abre a janela com os contatos da equipe responsável. */
export const FaleComAEquipe: React.FC = () => {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <p className={styles['chamada']}>
        Dúvidas ou problemas?{' '}
        <button type="button" className={styles['link']} onClick={() => setAberto(true)} aria-haspopup="dialog">
          <FontAwesomeIcon icon={faHeadset} />
          Fale com a equipe responsável ({EQUIPE.sigla})
        </button>
      </p>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Equipe responsável" size="medium">
        <div className={styles['janela']}>
          <p className={styles['intro']}>
            O Tarjador é mantido pela <strong>{EQUIPE.sigla}</strong>. Em caso de dúvida, problema ou sugestão, fale
            com a gente:
          </p>
          <ListaContatos />
          <p className={styles['dica']}>
            Ao relatar um problema, conte o que estava fazendo e a mensagem que apareceu na tela.{' '}
            <strong>Não envie por e-mail o PDF com dados pessoais.</strong>
          </p>
        </div>
      </Modal>
    </>
  )
}
