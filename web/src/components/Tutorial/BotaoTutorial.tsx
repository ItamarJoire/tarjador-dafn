import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import { useTour } from '@reactour/tour'
import { META_DEMONSTRACAO } from './exemplo'
import { montarPassos } from './passos'
import styles from './Tutorial.module.scss'

/** Botão do cabeçalho que abre o tutorial guiado do começo. */
export const BotaoTutorial: React.FC = () => {
  const { setIsOpen, setCurrentStep, setSteps, setMeta } = useTour()

  const abrir = () => {
    // Monta na hora: o histórico só entra se estiver visível. (A marca
    // data-tutorial do <html> fica com o SincronizarTutorial.)
    setSteps?.(montarPassos())
    // A sidebar passa a mostrar os lotes fictícios do exemplo (useDemonstracao)
    setMeta?.(META_DEMONSTRACAO)
    setCurrentStep(0)
    setIsOpen(true)
  }

  return (
    <button type="button" className={styles['botao']} onClick={abrir} data-tour="tutorial">
      <FontAwesomeIcon icon={faCircleQuestion} />
      <span>Tutorial</span>
    </button>
  )
}
