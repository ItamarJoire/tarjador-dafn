/** Pergunta, ao baixar o PDF tarjado, se o arquivo sai dos tarjamentos e vai para o histórico. */
export interface ConfirmarDownloadProps {
  /** Arquivo sendo baixado; null fecha o modal. */
  nomeArquivo: string | null
  /** O download está em andamento. */
  baixando: boolean
  /** Falha do download, mostrada dentro do modal. */
  erro: string | null
  /** Baixa e mantém nos tarjamentos. */
  onSoBaixar: () => void
  /** Baixa, tira dos tarjamentos e registra no histórico. */
  onConcluir: () => void
  onFechar: () => void
  /** Tutorial: marca os botões para o passo que os explica. */
  exemplo?: boolean
}
