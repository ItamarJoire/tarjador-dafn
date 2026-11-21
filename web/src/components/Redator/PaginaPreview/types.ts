import type { ArquivoLote } from '../../../services/RedatorService'

export interface PaginaPreviewProps {
  idLote: string
  /** Arquivo aberto na prévia; null fecha o modal. */
  arquivo: ArquivoLote | null
  pagina: number
  onTrocarPagina: (pagina: number) => void
  onClose: () => void
  /** Pede o download do PDF tarjado (abre a pergunta de concluir). */
  onBaixar: (arquivo: ArquivoLote) => void
  /** Tutorial: mostra esta imagem em vez de buscar a página na API. */
  imagemExemplo?: string
}
