/**
 * cancelar: lote em andamento (interrompe o OCR e apaga tudo).
 * apagar: lote pronto (apaga os PDFs tarjados).
 */
export type ModoExclusao = 'cancelar' | 'apagar'

/** Aviso, em vermelho, antes de uma ação que apaga arquivos sem volta. */
export interface ConfirmarExclusaoProps {
  open: boolean
  modo: ModoExclusao
  /** Arquivos do lote já tarjados, que também serão apagados. */
  jaTarjados: number
  /** O pedido está a caminho da API. */
  apagando: boolean
  /** Falha do pedido, mostrada dentro do aviso. */
  erro?: string | null
  onConfirmar: () => void
  onFechar: () => void
}
