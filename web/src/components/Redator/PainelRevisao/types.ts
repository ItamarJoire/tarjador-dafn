import type { ArquivoLote, Lote } from '../../../services/RedatorService'

/** Um lote na tela única: andamento, conferência e download. */
export interface PainelRevisaoProps {
  lote: Lote
  /** Falha ao consultar o andamento na API. */
  erro: string | null
  onVerPagina: (arquivo: ArquivoLote, pagina: number) => void
  /** Pede o download do PDF tarjado (abre a pergunta de concluir). */
  onBaixar: (arquivo: ArquivoLote) => void
  /** Índices dos arquivos já baixados e concluídos: não aparecem mais. */
  concluidos: number[]
  /** Apaga o lote na API; se ainda estiver processando, cancela antes. */
  onApagar: () => void
  /** O pedido de apagar/cancelar está a caminho da API. */
  apagando: boolean
  /** Falha ao apagar/cancelar. */
  erroAoApagar: string | null
  /** Lote fictício do tutorial: marcas para os passos e conferência já aberta. */
  exemplo?: boolean
}
