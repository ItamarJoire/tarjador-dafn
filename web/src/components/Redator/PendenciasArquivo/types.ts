import type { PaginaComPendencias } from '../agruparPorPagina'

export interface PendenciasArquivoProps {
  paginas: PaginaComPendencias[]
  /** Abre a prévia da página tarjada. */
  onVer: (pagina: number) => void
}
