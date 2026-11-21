import type { PaginaComPendencias } from '../agruparPorPagina'

export interface PendenciasArquivoProps {
  paginas: PaginaComPendencias[]
  /** Páginas já aprovadas na conferência. */
  aprovadas: number[]
  onAprovar: (pagina: number, aprovada: boolean) => void
  /** Abre a prévia da página tarjada. */
  onVer: (pagina: number) => void
}
