import React, { useState } from 'react'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import { Accordion } from '../../ui'
import { Modal } from '../../ui/Modal'
import { BotaoIcone } from '../Cabecalho/BotaoIcone'
import { GRUPOS_FAQ } from './perguntas'
import styles from './Faq.module.scss'

const TITULO = 'Perguntas frequentes'

/** Ícone de interrogação do cabeçalho: abre as perguntas frequentes num modal. */
export const BotaoFaq: React.FC = () => {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <BotaoIcone icone={faCircleQuestion} rotulo={TITULO} onClick={() => setAberto(true)} />

      <Modal open={aberto} onClose={() => setAberto(false)} title={TITULO} size="medium">
        <div className={styles['grupos']}>
          {GRUPOS_FAQ.map(grupo => (
            <section key={grupo.titulo} className={styles['grupo']}>
              <h4 className={styles['titulo-grupo']}>{grupo.titulo}</h4>
              <Accordion items={grupo.perguntas} className={styles['perguntas']} />
            </section>
          ))}
        </div>
      </Modal>
    </>
  )
}
