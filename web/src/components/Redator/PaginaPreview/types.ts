import type { ArquivoLote, RetanguloProporcional } from '../../../services/RedatorService'

export interface PaginaPreviewProps {
  idLote: string
  /** Arquivo aberto na prévia; null fecha o modal. */
  arquivo: ArquivoLote | null
  pagina: number
  onTrocarPagina: (pagina: number) => void
  onClose: () => void
  /** Pede o download do PDF tarjado (abre a pergunta de concluir). */
  onBaixar: (arquivo: ArquivoLote) => void
  /** Páginas deste arquivo aprovadas na conferência. */
  aprovadas: number[]
  onAprovar: (pagina: number, aprovada: boolean) => void
  /**
   * Aplica as tarjas desenhadas à mão na página. Devolve a mensagem de erro,
   * ou null se deu certo (a imagem da página é atualizada).
   */
  onTarjar: (pagina: number, retangulos: RetanguloProporcional[]) => Promise<string | null>
  /** Tutorial: mostra esta imagem em vez de buscar a página na API. */
  imagemExemplo?: string
}
