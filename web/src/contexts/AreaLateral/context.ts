import { createContext } from 'react'

/**
 * Elemento da faixa à direita do conteúdo, entre o cabeçalho e o rodapé (App).
 * A sidebar de tarjamentos é desenhada nele por portal: fica encaixada no
 * layout em vez de flutuar por cima da página. null até o App montar.
 */
export const AreaLateralContext = createContext<HTMLElement | null>(null)
