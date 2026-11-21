import { useEffect, useLayoutEffect } from 'react'
import { useTour } from '@reactour/tour'
import { PASSOS_DO_EXEMPLO, alvo } from './passos'

/**
 * Cuida de duas coisas do tutorial que o Reactour não faz sozinho:
 *
 * 1. Único dono da marca data-tutorial no <html>: "exemplo" nos passos que
 *    explicam a sidebar de tarjamentos, "" nos do formulário, e nenhuma com o
 *    tutorial fechado. Em tela estreita a sidebar cobre a tela: aparece só nos
 *    passos dela. (Não usa o beforeClose do Reactour: ele roda também quando o
 *    componente é montado de novo, como no modo de desenvolvimento do React.)
 *    Layout effect: roda antes da pintura, para o destaque já ser medido com a
 *    sidebar no lugar certo.
 *
 * 2. Procurar de novo o elemento destacado logo depois de cada troca de passo
 *    (e medir de novo quando a animação da janela termina).
 *    O Reactour procura no mesmo instante em que desenha o passo; quando o
 *    próprio passo abre o que vai destacar (a janela de Ver página, a pergunta
 *    de baixar), o elemento ainda não está na tela, o destaque cai no canto
 *    (0,0) e ele não procura de novo. Uma lista de passos "nova" (mesmo
 *    conteúdo) faz o Reactour redesenhar e achar o elemento.
 */
export const SincronizarTutorial = () => {
  const { isOpen, currentStep, steps, setSteps } = useTour()

  useLayoutEffect(() => {
    if (!isOpen) {
      delete document.documentElement.dataset.tutorial
      return
    }
    const seletor = steps[currentStep]?.selector
    const noExemplo = PASSOS_DO_EXEMPLO.some(nome => seletor === alvo(nome))
    document.documentElement.dataset.tutorial = noExemplo ? 'exemplo' : ''
  }, [isOpen, currentStep, steps])

  useEffect(() => {
    if (!isOpen || !setSteps) return
    setSteps(atuais => [...atuais])
    // Depois da animação de abertura das janelas (0,2s), medir de novo: medido
    // no meio dela, o contorno ficava deslocado. O Reactour remede no evento
    // de resize da janela (com o elemento já encontrado).
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 400)
    return () => window.clearTimeout(timer)
  }, [isOpen, currentStep, setSteps])

  return null
}
