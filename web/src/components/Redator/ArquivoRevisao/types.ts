import type { ArquivoLote } from '../../../services/RedatorService'

export interface ArquivoRevisaoProps {
  arquivo: ArquivoLote
  /** Páginas aprovadas na conferência (controle da pessoa). */
  aprovadas: number[]
  onAprovar: (pagina: number, aprovada: boolean) => void
  /** Abre a prévia da página tarjada. */
  onVerPagina: (arquivo: ArquivoLote, pagina: number) => void
  /** Pede o download do PDF tarjado (abre a pergunta de concluir). */
  onBaixar: (arquivo: ArquivoLote) => void
  /** Arquivo fictício do tutorial: conferência já aberta e marcas para os passos. */
  exemplo?: boolean
}
