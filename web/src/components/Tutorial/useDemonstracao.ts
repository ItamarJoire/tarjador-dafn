import { useTour } from '@reactour/tour'
import { META_DEMONSTRACAO } from './exemplo'

/** O tutorial está aberto mostrando os lotes de exemplo na sidebar. */
export const useDemonstracao = () => {
  const { isOpen, meta } = useTour()
  return isOpen && meta === META_DEMONSTRACAO
}

/**
 * Nome do passo atual do tutorial (o valor de data-tour que ele destaca),
 * enquanto o exemplo está ativo; null fora dele. A sidebar usa para abrir a
 * janela de Ver página e a pergunta de baixar nos passos certos.
 */
export const usePassoDoExemplo = (): string | null => {
  const { isOpen, meta, currentStep, steps } = useTour()
  if (!isOpen || meta !== META_DEMONSTRACAO) return null
  const seletor = steps[currentStep]?.selector
  return typeof seletor === 'string' ? (/data-tour="([^"]+)"/.exec(seletor)?.[1] ?? null) : null
}
